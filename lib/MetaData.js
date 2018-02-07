const uuidv1 = require('uuid/v1');

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
	this.id = options.id || uuidv1();
	this.startTime = options.startTime || new Date();
}

module.exports = MetaData;