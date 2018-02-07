const util = require('util');

function AbstractEnqueueError(message) {
	Error.call(this);
	this.message = "There was a problem with the queue" || message;
	this.statusCode = 500;
}

util.inherits(AbstractEnqueueError, Error);

module.exports = AbstractEnqueueError;