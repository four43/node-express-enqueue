const assert = require('assert'),
	Enqueue = require('../main'),
	express = require('express'),
	process = require('process'),
	request = require('supertest'),
	sinon = require('sinon');

var app,
	clock,
	queue,
	controllerSpy;

describe("Enqueue", function () {

	beforeEach(function () {
		queue = new Enqueue({
			concurrentWorkers: 2,
			maxSize: 4
		});
		controllerSpy = sinon.spy(function (req, res) {
			setTimeout(function () {
				res.status(200).json({foo: "bar"});
			}, 1000);
		});

		app = express();
		app.use(queue.getMiddleware());
		app.get('/test', controllerSpy);
		clock = sinon.useFakeTimers();
	});

	afterEach(function () {
		if (clock) {
			clock.restore();
		}
	});

	it("Should run a controller", function (done) {
		makeRequest(200, (err, res) => {
			assert.ifError(err);
			assert.equal(res.body.foo, 'bar');
			done();
		});

		queue.on(Enqueue.EVENT_PROCESSING_START, () => {
			if (clock) {
				clock.tick(1000);
			}
		});
	});

	it("Should queue", function (done) {
		for (var i = 0; i < 4; i++) {
			makeRequest(200, (err, res) => {
				if(controllerSpy.callCount === 2) {
					assert.equal(Date.now(), 1000);
					// Fire another set of workers
					clock.tick(1000);
				}
				else if(controllerSpy.callCount === 4) {
					assert.equal(Date.now(), 2000);
					done();
				}
			});
		}
		var queuedCount = 0;
		queue.on(Enqueue.EVENT_QUEUED, () => {
			queuedCount++;
			if (queuedCount === 4) {
				//Run all the queued controllers.
				clock.tick(1000);
			}
		});
	})
});

function makeRequest(expectedCode, callback) {
	request(app)
		.get('/test')
		.expect(expectedCode)
		.end(callback);
}