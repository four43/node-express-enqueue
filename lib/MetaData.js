const Guid = require('guid');

/**
 * A small object for holding meta data about a request.
 *
 * @param [options]
 * @param {Guid} [options.id=Guid.create()]
 * @param {Date} [options.startTime=new Date()]
 * @constructor
 */
function MetaData(options) {
	if(!options) options = {};
	this.id = options.id || Guid.create();
	this.startTime = options.startTime || new Date();
}

module.exports = MetaData;