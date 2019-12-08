console.log('Loading function');

var AWS = require('aws-sdk');
var dynamo = new AWS.DynamoDB.DocumentClient();
var fetchLeagueResults = require('./fetch-league-results.js');

/**
 * Provide an event that contains the following keys:
 *
 *   - operation: one of the operations in the switch statement below
 *   - tableName: required for operations that interact with DynamoDB
 *   - payload: a parameter to pass to the operation being performed
 */
exports.handler = function(event, context, callback) {
	fetchLeagueResults()
		.then(result => {
			callback(null, result);
		})
		.catch(e => {
			console.log('ERROR');
			callback(e, 'ERROR');
		});
};
