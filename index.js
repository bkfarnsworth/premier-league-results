console.log("Loading function");

var AWS = require("aws-sdk");
var dynamo = new AWS.DynamoDB.DocumentClient();

var querystring = require("querystring");
var http = require("https");
var fs = require("fs");
var fetchLeagueResults = require("./fetch-league-results.js");

console.log("fetchLeagueResults: ", fetchLeagueResults());

/**
 * Provide an event that contains the following keys:
 *
 *   - operation: one of the operations in the switch statement below
 *   - tableName: required for operations that interact with DynamoDB
 *   - payload: a parameter to pass to the operation being performed
 */
exports.handler = function(event, context, callback) {
  //console.log('Received event:', JSON.stringify(event, null, 2));

  var options = {
    host: "www.espn.com",
    path: "/soccer/schedule"
  };

  var req = http.get(options, function(res) {
    console.log("STATUS: " + res.statusCode);
    console.log("HEADERS: " + JSON.stringify(res.headers));

    // Buffer the body entirely for processing as a whole.
    var bodyChunks = [];
    res
      .on("data", function(chunk) {
        // You can process streamed parts here...
        bodyChunks.push(chunk);
      })
      .on("end", function() {
        var body = Buffer.concat(bodyChunks);
        console.log("BODY: " + body);

        callback(null, body + "");

        // ...and/or process the entire body here.
      });
  });

  var operation = event.operation;

  if (event.tableName) {
    event.payload.TableName = event.tableName;
  }

  switch (operation) {
    case "create":
      dynamo.put(event.payload, callback);
      break;
    case "read":
      dynamo.get(event.payload, callback);
      break;
    case "update":
      dynamo.update(event.payload, callback);
      break;
    case "delete":
      dynamo.delete(event.payload, callback);
      break;
    case "list":
      dynamo.scan(event.payload, callback);
      break;
    case "echo":
      callback(null, "Success");
      break;
    case "ping":
      // callback(null, "pong2");
      break;
    default:
      callback("Unknown operation: ${operation}");
  }
};
