# BullMQ на Amvera

BullMQ нужен тогда, когда какую-либо долгую или повторяющуюся работу необходимо выполнять отдельно от веб-приложения.

Это самый простой пример: веб-приложение отправляет строку через Redis, общий worker переводит ее в верхний регистр, а результат сохраняется в Redis.

## Какие проекты нужны

Для проверки создайте три проекта в **одном регионе**:

1. Любое Node.js приложение, которое отправляет задачу;
2. Redis из преднастроенных сервисов Amvera;
3. Отдельное приложение с общим worker из репозитория [`amvera-nodejs-bullmq-worker-example`](https://github.com/amvera-academy/amvera-nodejs-bullmq-worker-example).

Worker не зависит от обычного Node.js, Express, Next.js или NestJS. Его можно использовать с любым Node.js приложением.

## Переменная REDIS_URL

В веб приложении и worker задайте переменную `REDIS_URL` с внутренним доменом Redis:

```text
REDIS_URL=redis://:<пароль>@<внутренний-домен-redis>:6379/0
```

Внутренний домен работает только между проектами в одном регионе. Связать проекты с помощью внешнего домена может не получиться.

## Отправка задачи

Добавьте BullMQ и ioredis в зависимости:

```bash
npm install bullmq ioredis
```

Создайте подключение и очередь, затем отправьте задачу с именем `process_text`:

```javascript
const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null
});
const queue = new Queue("tasks", { connection });

async function startTask(text) {
  return queue.add("process_text", { text });
}
```

`job.id`, который мы получили по итогу, можно вернуть через API.

## Получение статуса и результата

Задачу можно получить по идентификатору через `Job.fromId`:

```javascript
const { Job } = require("bullmq");

async function getTask(taskId) {
  const job = await Job.fromId(queue, taskId);
  if (!job) return null;

  return {
    status: await job.getState(),
    result: job.returnvalue
  };
}
```

Состояние `completed` означает, что worker завершил задачу и записал результат. В состоянии `failed` причину можно получить из `job.failedReason`.

## Важно про BullMQ

Веб-приложение и worker должны использовать одинаковое имя очереди `tasks` и один Redis. Worker запускается отдельным проектом.

Для подключения worker используется `maxRetriesPerRequest: null`. Без этого ioredis может завершать ожидающие Redis-команды по лимиту повторных попыток, что несовместимо с долгоживущим worker.

Для подключения воркера используется maxRetriesPerRequest: null. Если не указать это, что ioredis может завершать ожидающие Redis-команды по лимиту ретраев, что несовместимо с долгоживущим воркером.