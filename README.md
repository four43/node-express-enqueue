# node-express-enqueue

A rate-limiting middleware that ensures only the desired number of requests are being worked on concurrently.

[![Build Status](https://travis-ci.org/four43/node-express-enqueue.svg?branch=master)](https://travis-ci.org/four43/node-express-enqueue)
[![Coverage Status](https://coveralls.io/repos/github/four43/node-express-enqueue/badge.svg?branch=master)](https://coveralls.io/github/four43/node-express-enqueue?branch=master)

## Example

`express-enqueue` is instantiated before use:
```javascript
const Enqueue = require('express-enqueue'),
    app = require('express')();
    
const queue = new Enqueue({
    concurrentWorkers: 4,
    maxSize: 200,
    timeout: 30000
});

app.use(queue.getMiddleware());
app.get('/hello', (req, res) => res.json({hello:'world'}));
app.use(queue.getErrorMiddleware());
app.listen(9000);
```

## Options

| Option              |            Type (default)  | Description                                                                                                        |
|---------------------|----------------------------|--------------------------------------------------------------------------------------------------------------------|
| `concurrentWorkers` | Integer (# of cores)       | The number of concurrent workers, how many requests should be worked on at once.                                   |
| `queueMaxSize`      | Integer (1000)             | The maximum number of open requests.                                                                               |
| `timeout`           | Integer,time in ms. (none) | If a request has been sitting the queue for more than this time, it will be skipped and an error will be returned. |

## Methods

### getMiddleware()

Gets the Express middleware. This queue can be used app-wide or to limit a specific controller.

### getErrorMiddleware(`json`)

Gets the error handling middleware that will parse `express-enqueue` specific errors and send appropriate error codes and messages. It will output them in JSON by default, but when the first argument is set to false it will just output the message. 

### getStats()

Returns stats about the queue, `{{total: number, inProgress: number, waiting: number}}`