const _ = require('lodash');
const axios = require('axios');
const cheerio = require('cheerio');

// var allResults = await Promise.all([
// 	axios.get('https://www.google.com'),
// 	axios.get('https://www.espn.com')
// ]);

// const html =
// console.log('html: ', html.data);

// const $ = cheerio.load(html.data);
// const tables = $('table');
// const teams = $('.team-link:last-child')
// 	.toArray()
// 	.map(el => $(el).text());

module.exports = async function main() {
	var premTable = await getPremierLeagueTable();

	var schedulePromises = [];
	traverseTables([premTable], {
		forEachRow: function(row) {
			var scheduleLink = createScheduleLinkFromTeamLink(row[1]);
			schedulePromises.push(
				axios.get(scheduleLink).then(res => ({ res, premRow: row }))
			);
		}
	});

	const results = await Promise.all(schedulePromises);

	//add a "Remaining Difficulty" column and add all combined points into premTable
	premTable[0].push('Remaining Difficulty');
	results.forEach(function({ res, premRow }) {
		const $ = cheerio.load(res.data);
		var tables = $('table').toArray();
		var scheduleTables = tables.map(function(t) {
			return getCellsFromTable(t);
		});

		//clean up all schedule tables to have the right bournemouth name
		traverseTables(scheduleTables, {
			forEachRow: function(row) {
				var team1 = row[1];
				var team2 = row[3];
				row[1] = convertToValidName(team1);
				row[3] = convertToValidName(team2);
			}
		});

		var combinedOpponentPoints = getRemainingDifficultyForTeam(
			premRow[0],
			scheduleTables,
			premTable
		);
		premRow.push(combinedOpponentPoints);
	});

	console.log('premTable: ', premTable);

	return premTable;
};

//we need link like this: https://www.espn.com/soccer/team/fixtures/_/id/364/liverpool
//we get link like this: /soccer/team/_/id/364/liverpool
function createScheduleLinkFromTeamLink(teamLink) {
	var newLink = '';
	newLink += 'https://www.espn.com';
	newLink += teamLink;
	newLink = newLink.replace('/_/', '/fixtures/_/');
	return newLink;
}

function traverseTables(tables, opts) {
	var forEachTable = opts.forEachTable || function() {};
	var forEachRow = opts.forEachRow || function() {};
	var forEachCell = opts.forEachCell || function() {};
	var includeHeader = opts.includeHeader || false;

	tables.forEach(function(table, tableIndex) {
		forEachTable(table, tableIndex);
		table.forEach(function(row, rowIndex) {
			if (rowIndex !== 0 || includeHeader) {
				forEachRow(row, rowIndex);
			}
			row.forEach(function(cell, cellIndex) {
				forEachCell(cell, cellIndex);
			});
		});
	});
}

function getRemainingDifficultyForTeam(team, scheduleTables, premTable) {
	//find all teams the team hasn't played yet
	var opponentsLeftToPlay = determineTeamsLeftToPlay(team, scheduleTables, {
		currentHalfOnly: true
	});

	//create a lookup table of team name to points
	var premTableAsObjects = getTableAsObjects(premTable);
	var pointsByTeamName = {};
	premTableAsObjects.forEach(function(row, rowIndex) {
		pointsByTeamName[row['2019-2020']] = row.P;
	});

	//now create a sum of points
	var combinedPoints = 0;
	opponentsLeftToPlay.forEach(function(opponent) {
		combinedPoints += pointsByTeamName[opponent];
	});

	return combinedPoints;
}

function getTableAsObjects(tableAsArray) {
	var headerRow;
	var newTable = [];
	tableAsArray.forEach(function(row, rowIndex) {
		if (rowIndex === 0) {
			headerRow = row;
		} else {
			var newRow = {};
			row.forEach(function(cell, cellIndex) {
				newRow[headerRow[cellIndex]] = cell;
			});

			newTable.push(newRow);
		}
	});

	return newTable;
}

function getCell(table, rowKeyOrIndex, columnKeyOrIndex) {
	var row;
	if (typeof rowKeyOrIndex === 'string') {
		row = table.filter(function(r) {
			return r[0] === rowKeyOrIndex;
		})[0];
	} else if (typeof rowKeyOrIndex === 'number') {
		row = table[rowKeyOrIndex];
	}

	var cell;
	if (typeof columnKeyOrIndex === 'string') {
		var headerRow = table[0];
		var columnIndex = headerRow.indexOf(columnKeyOrIndex);
		cell = row[columnIndex];
	} else if (typeof columnKeyOrIndex === 'number') {
		cell = row[columnKeyOrIndex];
	}

	return cell;
}

function determineTeamsLeftToPlay(teamInQuestion, dataTables) {
	var teamsLeftToPlay = [];
	traverseTables(dataTables, {
		forEachRow: function(row) {
			if (row.indexOf('English Premier League') !== -1) {
				var team1 = row[1];
				var team2 = row[3];
				//find the opponent, not the current team
				var opponent = team1 === teamInQuestion ? team2 : team1;
				teamsLeftToPlay.push(opponent);
			}
		}
	});

	return teamsLeftToPlay;
}

async function getPremierLeagueTable() {
	var url = 'https://www.espn.com/soccer/table/_/league/eng.1';
	var response = await axios.get(url);
	var html = response.data;
	var tables = html.match(/<table.*?<\/table>/gm);
	var teamTable = tables[0];
	var pointsTable = tables[1];
	var teamCells = getCellsFromTable(teamTable, {
		createCustomCells: function(cell, cellIndex, row, rowIndex) {
			var customCells = [];

			//if it is a cell with a team name in it, go get the link
			//else it must be the header cell
			if (rowIndex !== 0) {
				//create the links as cells
				var links = cell.find('a').toArray();
				var hrefs = links.map(link => _.get(link, 'attribs.href'));
				customCells = get(() => [hrefs[0]]) || [];
			} else {
				customCells = ['Link'];
			}

			return customCells;
		}
	});
	var pointCells = getCellsFromTable(pointsTable);

	//combine cells
	var combinedCells = pointCells.slice();
	teamCells.forEach(function(cell, i) {
		combinedCells[i] = cell.concat(combinedCells[i]);
	});

	//clean up name
	combinedCells.forEach(function(cell, i) {
		//skip header
		if (i === 0) {
			return;
		}
		var teamName = cell[0];
		var validNames = getValidTeamNames();
		var validTeamName = validNames.filter(function(name) {
			return teamName.indexOf(name) !== -1;
		})[0];
		cell[0] =
			validTeamName ||
			'Team Name Missing - Check Script to Add to Array of Teams';
	});

	//convert strings to numbers
	combinedCells.forEach(function(cells, i) {
		cells.forEach(function(cell, j) {
			var asNum = Number(cell);
			if (!isNaN(asNum)) {
				cells[j] = asNum;
			}
		});
	});

	return combinedCells;
}

function getCellsFromTable(table, opts) {
	var opts = opts || {};
	var createCustomCells =
		opts.createCustomCells ||
		function() {
			return [];
		};

	const $ = cheerio.load(table);
	var rows = $('tr')
		.toArray()
		.map(rowEl => {
			return $(rowEl)
				.find('td,th')
				.toArray();
		})
		.map((row, rowIndex) => {
			var processedCells = [];
			row.forEach(function(cell, cellIndex) {
				//add the cell as a string
				processedCells.push($(cell).text());

				//now run the custom cell creator to add additionalCells
				var customCells = createCustomCells(
					$(cell),
					cellIndex,
					$(row),
					rowIndex
				);
				processedCells = processedCells.concat(customCells);
			});

			return processedCells;
		});

	return rows;
}

//another easy thing to hard code would be last years finish
//if there are easy things to hard code, then I will be happy it doesn't have to request those
//  //build a hard coded data set that includes ids, alternateNames, etc
function getValidTeamNames() {
	return [
		'Liverpool',
		'Leicester City',
		'Manchester City',
		'Chelsea',
		'Wolverhampton Wanderers',
		'Sheffield United',
		'Burnley',
		'Arsenal',
		'Manchester United',
		'Tottenham Hotspur',
		'Bournemouth',
		'Brighton & Hove Albion',
		'Crystal Palace',
		'Newcastle United',
		'Everton',
		'West Ham United',
		'Aston Villa',
		'Norwich City',
		'Southampton',
		'Watford'
	];
}

function convertToValidName(badName) {
	//try swapping
	var invalidNamePair = getInvalidNamePair(badName);
	if (invalidNamePair) {
		return invalidNamePair;
	}

	//for now if we got here, assume it was a good name
	return badName;
}

function getInvalidNamePair(str) {
	return invalidNameMap()[str] || swap(invalidNameMap())[str];
}

function invalidNameMap() {
	return {
		'AFC Bournemouth': 'Bournemouth'
	};
}

function swap(json) {
	var ret = {};
	for (var key in json) {
		ret[json[key]] = key;
	}
	return ret;
}

function get(func, defaultVal) {
	try {
		return func();
	} catch (e) {
		return defaultVal;
	}
}

// class Table {
// 	constructor() {
// 		this.rows = []
// 	}
// }

// class Row {
// 	constructor() {
// 		this.teamName = ''
// 		this.gamesPlayed = ''
// 	}
// }
