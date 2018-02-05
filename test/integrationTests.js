const assert = require('assert'),
	Enqueue = require('../main'),
	express = require('express'),
	request = require('supertest');

let app,
	delay = 100,
	queue,
	controller;

describe("Enqueue", function () {

	beforeEach(function () {
		queue = new Enqueue({
			concurrentWorkers: 2,
			maxSize:           4
		});

		controller = function (req, res) {
			setTimeout(function () {
				res.status(200).json({foo: "bar"});
			}, delay);
		};

		app = express();
		app.use(queue.getMiddleware());
		app.get('/test', controller);
		app.use(queue.getErrorMiddleware());
	});

	it("Should run a basic controller", function (done) {
		makeRequest(200, (err, res) => {
			assert.ifError(err);
			assert.equal(res.body.foo, 'bar');
			done();
		});
	});

	it("Should queue", function (done) {
		const finishTimes = [];

		const testResults = (finishTimes) => {
			if (finishTimes.length === 4) {
				// Done now
				assert.ok(finishTimes[1] - finishTimes[0] <= delay * 0.2, "First group didn't run together");
				// Slight clock drift problem here, check to make sure we're close
				assert.ok(finishTimes[2] - finishTimes[0] >= delay * 0.3, "The groups should be separate, should wait for first group to finish. Only " + (finishTimes[2] - finishTimes[0]) + "ms. difference");
				assert.ok(finishTimes[3] - finishTimes[2] <= delay * 0.2, "The second group should run together");
				done();
			}
		};

		for (let i = 0; i < 4; i++) {
			makeRequest(200, (err, res) => {
				assert.ifError(err);
				finishTimes.push(Date.now());
				testResults(finishTimes)
			});
		}
	});

	it("Should error if too many added to queue", function (done) {
		for (let i = 0; i < 4; i++) {
			makeRequest(200, () => {
			});
		}
		makeRequest(503, (err, res) => {
			assert.ifError(err);
			assert.ok(res.body.error, 'Queue full, please try again later');
			done();
		});
	});

	it("Should timeout", function (done) {
		queue = new Enqueue({
			concurrentWorkers: 2,
			timeout:           delay / 2
		});
		app = express();
		app.use(queue.getMiddleware());
		app.get('/test', controller);
		app.use(queue.getErrorMiddleware(false));

		// Fill the queue with 2 concurrent requests that will take longer than our timeout
		makeRequest(200, () => {
		});
		makeRequest(200, () => {
		});
		// Our last request will start after out timeout period has passed (the client hung up)
		makeRequest(503, (err, res) => {
			assert.ifError(err);
			assert.ok(res.text, 'Request timed out while waiting in queue to be handled');

			assert.deepEqual(queue.getStats(), {
				inProgress: 0,
				waiting:    0,
				total:      0
			});
			done();
		});
	});

	it("Should Provide stats", function (done) {
		for (let i = 0; i < 4; i++) {
			makeRequest(200, () => {
			});
		}
		setTimeout(() => {
			assert.deepEqual(queue.getStats(), {
				"total":      2,
				"inProgress": 2,
				"waiting":    0
			});
			done();
		}, delay * 1.2);
	});
});

function makeRequest(expectedCode, callback) {
	request(app)
		.get('/test')
		.expect(expectedCode)
		.end(callback);
}