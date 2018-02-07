'use strict';
const assert = require('assert'),
	Enqueue = require('../main'),
	express = require('express'),
	os = require('os'),
	request = require('supertest');

let app,
	delay = 100,
	queue,
	testController;

describe("Enqueue", () => {

	beforeEach(() => {
		queue = new Enqueue({
			concurrentWorkers: 2,
			maxSize:           4
		});

		testController = (req, res) => {
			setTimeout(() => {
				res.status(200).json({foo: "bar"});
			}, delay);
		};

		app = express();
		app.use(queue.getMiddleware());
		app.get('/test', testController);
		app.use(queue.getErrorMiddleware());
	});

	it("should use all available cores by default", () => {
		queue = new Enqueue();
		assert.equal(queue.concurrentWorkers, os.cpus().length);
	});

	it("should run a basic controller", (done) => {
		makeRequest(app, 200, (err, res) => {
			assert.ifError(err);
			assert.equal(res.body.foo, 'bar');
			done();
		});
	});

	it("should use user error handler", (done) => {
		app.get('/app', (req, res, next) => {
			next(new Error("My error"));
		});

		app.use((err, req, res, next) => {
			try {
				assert.equal(err.message, "My error");
				done();
			}
			catch(err) {
				done(err);
			}
		});

		request(app)
			.get('/app')
			.then();
	});

	it("should queue", (done) => {
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
			makeRequest(app, 200, (err) => {
				assert.ifError(err);
				finishTimes.push(Date.now());
				testResults(finishTimes)
			});
		}
	});

	it("should queue (only one at a time)", (done) => {
		let queue = new Enqueue({
			concurrentWorkers: 1
		});

		let app = express();
		app.use(queue.getMiddleware());

		app.get('/test', testController);

		const finishTimes = [];

		const testResults = (finishTimes) => {
			if (finishTimes.length === 4) {
				// Done now
				assert.ok(finishTimes[1] - finishTimes[0] >= delay * 0.9, "Requests ran together");
				assert.ok(finishTimes[2] - finishTimes[1] >= delay * 0.9, "Requests ran together");
				assert.ok(finishTimes[3] - finishTimes[2] >= delay * 0.9, "Requests ran together");
				done();
			}
		};

		for (let i = 0; i < 4; i++) {
			makeRequest(app, 200, (err) => {
				assert.ifError(err);
				finishTimes.push(Date.now());
				testResults(finishTimes)
			});
		}
	});

	it("should error if too many added to queue", (done) => {
		for (let i = 0; i < 4; i++) {
			makeRequest(app, 200, () => {
			});
		}
		makeRequest(app, 503, (err, res) => {
			assert.ifError(err);
			assert.ok(res.body.error, 'Queue full, please try again later');
			done();
		});
	});

	it("should timeout", (done) => {
		let queue = new Enqueue({
			concurrentWorkers: 2,
			timeout:           delay / 2
		});
		let app = express();
		app.use(queue.getMiddleware());
		app.get('/test', testController);
		app.use(queue.getErrorMiddleware(false));

		// Fill the queue with 2 concurrent requests that will take longer than our timeout
		makeRequest(app, 200, () => {
		});
		makeRequest(app, 200, () => {
		});
		// Our last request will start after out timeout period has passed (the client hung up)
		makeRequest(app, 503, (err, res) => {
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

	it("should remove aborted requests", (done) => {
		let main = request(app)
			.get('/test')
			.timeout({
				// Abort!
				response: 10
			})
			.then((res) => {
				done(new Error("Request should have been aborted"))
			})
			.catch(err => {
				try {
					// Let the aborted request get cleaned up
					setTimeout(() =>
						assert.deepEqual(queue.getStats(), {
							inProgress: 0,
							waiting:    0,
							total:      0
						}), 10);
				}
				catch (err) {
					return done(err)
				}
				done();
			});
	});

	// To fix: https://github.com/four43/node-express-enqueue/issues/1
	it("should remove aborted request when it is waiting in queue", (done) => {
		let queue = new Enqueue({
			concurrentWorkers: 1
		});

		let app = express();
		app.use(queue.getMiddleware());

		app.get('/test', (req, res, next) => {
			setTimeout(() => {
				res.status(200).json({foo: "bar"});
			}, 100);
		});

		app.get('/never', () => {
			done(new Error("Shouldn't ever hit this controller, should abort first."));
		});

		request(app)
			.get('/test')
			.expect(200, (res) => {});

		let secondReq = request(app)
			.get('/never');

		secondReq
			.then((res) => {});

		// Abort our second request before we even started
		setTimeout(() => secondReq.abort(), 10);

		request(app)
			.get('/test')
			.expect(200, () => {
				try {
					assert.deepEqual(queue.getStats(), {
						inProgress: 0,
						waiting:    0,
						total:      0
					});
					done()
				}
				catch (err) {
					return done(err);
				}
			});
	});

	it("should Provide stats", (done) => {
		for (let i = 0; i < 5; i++) {
			makeRequest(app, 200, () => {
			});
		}
		setTimeout(() => {
			assert.deepEqual(queue.getStats(), {
				"total":      2,
				"inProgress": 2,
				"waiting":    0
			});
			done();
		}, delay * 1.5);
	});
});

function makeRequest(app, expectedCode, callback) {
	request(app)
		.get('/test')
		.expect(expectedCode)
		.end(callback);
}