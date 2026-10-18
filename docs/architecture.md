# Архитектура

## Реализованный стек

npm workspaces: `apps/web`, `apps/server`, `packages/contracts`, общий корневой
lockfile. React/Vite/TypeScript, Tailwind CSS, локальные shadcn-style компоненты
и Sonner на клиенте; Fastify/TypeScript и Undici на сервере; общие Zod-контракты.
SQLite использует встроенный `node:sqlite`. Текущие настройки TypeScript находятся
в tsconfig-файлах пакетов; не менять их без причины.

## Файлы и ответственность

| Область | Реализация |
| --- | --- |
| Навигация, редактор и история | `apps/web/src/App.tsx`, `components/` |
| Состояние и запросы клиента | `apps/web/src/use-correction*.ts`, `use-history.ts` |
| Diff, clipboard и форматирование | `apps/web/src/lib/` |
| Создание Fastify-приложения | `apps/server/src/app.ts` |
| HTTP коррекции, настройки и модели | `apps/server/src/correction-api.ts` |
| HTTP истории | `apps/server/src/history-api.ts` |
| Промпт strict-v3 и обработка попытки | `apps/server/src/correction-service.ts` |
| ENV и proxy policy | `apps/server/src/correction-config.ts` |
| OpenRouter через Undici | `apps/server/src/openrouter.ts` |
| SQLite, миграции и запросы | `apps/server/src/database.ts` |
| Публичные схемы и две модели | `packages/contracts/src/index.ts` |
| Ручной benchmark | `apps/server/src/benchmark*.ts` |

Fastify CLI запускает приложение; `app.ts` явно регистрирует API коррекции и
истории. Autoload подключает `routes/root.ts`: GET `/` возвращает `{root:true}`.
Это простой ответ сервера, а не полноценная проверка готовности размещения.
Соединения SQLite и HTTP освобождаются через lifecycle приложения.

## API и поток данных

- GET `/api/correction-config`: модели, сохранённый выбор, лимиты, доступность.
- PUT `/api/model-preference`: сохранение выбранной модели.
- POST `/api/corrections`: текст, модель, необязательный correctionId для повтора.
- GET `/api/history`: поиск, фильтры, сортировка, страница и доступные модели.
- GET `/api/history/:correctionId`: исходник и все попытки с результатами/метриками.

Удаление истории не реализовано. Точные схемы находятся в contracts.
Клиент отправляет только текущий текст и выбранную модель, без истории.
Сервер проверяет запрос, записывает начало попытки, вызывает OpenRouter и
сохраняет результат или ошибку. Diff вычисляется локально, Copy берёт чистый текст.
Поиск истории использует совпадение фразы без учёта регистра в исходнике или
любом результате; фильтры могут совпадать с любой попыткой. Страница: 10 записей.

## SQLite и сохранение

Текущая версия схемы: 3. Миграции выполняются транзакционно при открытии базы.
`corrections` хранит UUID, время, точный исходник, язык `ru` и режим `strict`.
`model_requests` хранит отдельные попытки, параметры, версию промпта, результат,
статус, безопасную ошибку и доступные метрики. `model_preference` хранит выбор.

UUID и ISO timestamps используются в публичных записях. Неизвестные метрики
остаются null; стоимость выражена в USD, время приложения в миллисекундах.
Старые модели в истории допустимы. Удалённый из выбора modelId не блокирует
чтение истории; неподдерживаемая настройка сбрасывается на Gemma при загрузке
конфигурации. Незавершённые попытки отмечаются прерванными без повторных вызовов.
Сырые ответы, секреты и текст reasoning не сохраняются.

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
