# Архитектура

## Реализованный стек

npm workspaces: `apps/web`, `apps/server`, `packages/contracts`, общий корневой
lockfile. React/Vite/TypeScript, Tailwind CSS, локальные shadcn-style компоненты
и Sonner на клиенте; Fastify/TypeScript и Undici на сервере; общие Zod-контракты.
SQLite использует Drizzle ORM и `better-sqlite3`. Текущие настройки TypeScript находятся
в tsconfig-файлах пакетов; не менять их без причины.

## Файлы и ответственность

| Область | Реализация |
| --- | --- |
| Навигация, редактор и история | `apps/web/src/App.tsx`, `components/` |
| Состояние и запросы клиента | `apps/web/src/use-correction*.ts`, `use-history.ts` |
| Diff, clipboard и форматирование | `apps/web/src/lib/` |
| Создание Fastify-приложения | `apps/server/src/app.ts` |
| Создание и освобождение общих ресурсов | `apps/server/src/app-resources.ts` |
| Структурированные диагностические логи | `apps/server/src/logging/`, публичный вход `index.ts` |
| HTTP коррекции | `apps/server/src/routes/corrections.ts` |
| HTTP настроек модели | `apps/server/src/routes/model-settings.ts` |
| HTTP истории | `apps/server/src/routes/history.ts` |
| Обработка попытки и контракты зависимостей | `apps/server/src/correction/` |
| Промпт strict-v3 и параметры запроса | `apps/server/src/correction/prompt.ts` |
| Проверка ответа и метаданных OpenRouter | `apps/server/src/openrouter/response.ts` |
| ENV и proxy policy | `apps/server/src/correction-config.ts` |
| OpenRouter через Undici | `apps/server/src/openrouter/transport.ts` |
| Инициализация SQLite и восстановление попыток | `apps/server/src/database/sqlite-database.ts` |
| Открытие соединения и подключение Drizzle | Приватные методы `openConnection()` и `createDrizzleClient()` в `SqliteDatabase` |
| Версионные транзакционные миграции | `apps/server/src/database/migrations.ts` |
| Типизированная схема SQLite | `apps/server/src/database/schema.ts` |
| SQL-миграции Drizzle и snapshots | `apps/server/drizzle/`, `apps/server/drizzle.config.ts` |
| Запись попыток коррекции | `apps/server/src/database/repositories/correction-repository.ts` |
| Запросы и преобразование истории | `apps/server/src/database/repositories/history-repository.ts` |
| Сохранённая модель | `apps/server/src/database/repositories/model-preference-repository.ts` |
| Публичные схемы и две модели | `packages/contracts/src/{models,correction,history}.ts`, экспорт через `index.ts` |
| Ручной benchmark | `apps/server/src/benchmark/` |

Fastify CLI запускает приложение; `app.ts` явно регистрирует все группы из
`routes/` и передаёт им зависимости. GET `/` возвращает `{root:true}`.
Это простой ответ сервера, а не полноценная проверка готовности размещения.
`app-resources.ts` создаёт общие ресурсы и освобождает соединения SQLite и HTTP
через lifecycle приложения.

`correction/`, `openrouter/`, `database/` и `benchmark/` являются внутренними
модулями server workspace. Между модулями используются публичные `index.ts`;
внутри модуля допустимы прямые импорты файлов. Drizzle и SQLite-драйвер остаются
внутри database/; correction и HTTP-слой не зависят от ORM.

Correction зависит от небольших контрактов записи попыток и транспорта.
OpenRouter возвращает разобранный результат с метриками или кодом ошибки,
не передавая разбор ответа в correction. История и настройки модели получают
только нужные им операции хранилища. SQLite остаётся реализацией этих контрактов.

`database/sqlite-database.ts` открывает соединение, запускает миграции и явно помечает
прерванные попытки, затем создаёт операции записи, истории и настроек. Запросы
используют типизированные таблицы Drizzle; параметры привязываются без конкатенации
пользовательского текста. Формат сохранённых данных и публичные контракты сохранены.

`benchmark/cli.ts` остаётся отдельной точкой входа, доступной только человеку.
Он не экспортируется публичным `index.ts` и не импортируется сервером или тестами.
Ручные команды и локальный каталог benchmark-data сохраняются.

## API и поток данных

- GET `/health`: локальная проверка конфигурации и чтения SQLite; без запросов
  к OpenRouter/VPN. Возвращает 200 или 503 с безопасной причиной.

- GET `/api/correction-config`: модели, сохранённый выбор, лимиты, доступность.
- PUT `/api/model-preference`: сохранение выбранной модели.
- POST `/api/corrections`: текст, модель, необязательный correctionId для повтора.
- GET `/api/history`: первая страница истории с настройками по умолчанию.
- POST `/api/history/search`: поиск, фильтры, сортировка, страница и доступные модели.
- GET `/api/history/:correctionId`: исходник и все попытки с результатами/метриками.

Удаление истории не реализовано. Точные схемы находятся в contracts.
Клиент отправляет только текущий текст и выбранную модель, без истории.
Сервер проверяет запрос, записывает начало попытки, вызывает OpenRouter и
сохраняет результат или ошибку. Diff вычисляется локально, Copy берёт чистый текст.
Поиск истории использует совпадение фразы без учёта регистра в исходнике или
любом результате; фильтры могут совпадать с любой попыткой. Страница: 10 записей.

## SQLite и сохранение

Миграции выполняются транзакционно при открытии базы. Новые базы создаются из
SQL-миграций Drizzle. Для существующей базы текущей схемы baseline однократно
регистрируется вне приложения в `__drizzle_migrations`, без пересоздания таблиц.
В приложении нет обновления старых версий схемы или автоматической регистрации
baseline. Историю миграций ведёт Drizzle. Выбор модели при повторном открытии
не перезаписывается.
`corrections` хранит UUID, время, точный исходник, язык `ru` и режим `strict`.
`model_requests` хранит отдельные попытки, параметры, версию промпта, результат,
статус, безопасную ошибку и доступные метрики. `model_preference` хранит выбор.

UUID и ISO timestamps используются в публичных записях. Неизвестные метрики
остаются null; стоимость выражена в USD, время приложения в миллисекундах.
Старые модели в истории допустимы. Удалённый из выбора modelId не блокирует
чтение истории; неподдерживаемая настройка сбрасывается на Gemma при загрузке
конфигурации. Незавершённые попытки отмечаются прерванными без повторных вызовов.
Сырые ответы, секреты и текст reasoning не сохраняются.

Для изменения схемы: `npm run db:generate -w apps/server -- --name=<change>`,
затем проверка SQL и commit файлов из `apps/server/drizzle/`. Baseline содержит
начальный выбор модели. `drizzle-kit push` для сохранённых баз
не используется. При упаковке рядом с `dist/` нужен каталог `drizzle/` с SQL и
metadata. Query logging выключен; диагностика не выводит SQL и параметры.

## Параметры модели

Gemma 4 26B A4B по умолчанию, Gemini 3.1 Flash Lite как альтернатива.
Параметры: `reasoning.enabled=false`, `stream=false`, `max_tokens=8192`,
`provider.require_parameters=true`, `provider.allow_fallbacks=false`.
Лимит ввода: 5 000 Unicode code points; timeout: 60 секунд.
Нет автоматических retries, streaming или кеширования результата.
Приложение отвергает ответы с reasoning; benchmark не применяет этот guard,
но сохраняет reported usage и стоимость. Остальная проверка ответа сохраняется.

## Ручной benchmark V3

Отдельный CLI не импортируется приложением и запускается только пользователем,
включая preview. Для каждого запуска создаются отдельные SQLite, manifest и
автономный HTML-отчёт; история и настройки приложения не затрагиваются.
Нет новых API, экранов или таблиц benchmark. Тексты и результаты исключены из Git.
Порядок работы и запрет запуска агентами: [benchmark.md](benchmark.md).

## Разработка и оставшееся размещение

Команды: [AGENTS.md](../AGENTS.md#commands). Сборки приложений сначала собирают
contracts. В разработке Vite и Fastify работают отдельно; Vite проксирует `/api`.
Серверные тесты используют Fastify inject, временную SQLite и подставной транспорт.

Пункт 6 ещё не завершён: один контейнер, Fastify для API и frontend, постоянный
том SQLite, deployment health checks и backup/restore. Текущий API ещё не
обслуживает собранный frontend. Сетевая политика: [environments.md](environments.md).
