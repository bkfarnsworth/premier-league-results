//https://developers.google.com/apps-script/reference/xml-service/xml-service

function main() {
  var premTable = getPremierLeagueTable();

  //need to load the schedule for each team in the prem league
  traverseTables([premTable], {
    forEachRow: function(row) {
      var premTeam = row[0];
      Logger.log(premTeam);
    }
  });

  //ID IS IN THE LINK - JUST GET IT THERE
  //get ID for each team and just hard code them
  //build a hard coded data set that includes ids, alternateNames, etc

  //need to load the prem table
  var request1 = {
    url: "https://www.espn.com/soccer/table/_/league/eng.1",
    method: "get"
  };

  //for each prem team

  var request2 = {
    url: "https://www.espn.com/soccer/team/fixtures/_/id/364/liverpool",
    method: "get"
  };
  var result = new RetriableRequestsBatch(UrlFetchApp, [
    request1,
    request2
  ]).fetchWithRetries();
  if (result.error) {
    console.error("Error happened when fetching batch:", result.error);
    return;
  }
  console.log(
    "Succesfully fetched requests batch. Responses: result.responses"
  );
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

function getRemainingDifficulty() {
  var url = "https://www.espn.com/soccer/team/fixtures/_/id/364/liverpool";
  var html = UrlFetchApp.fetch(url).getContentText();
  var tables = html.match(/<table.*?<\/table>/gm);
  var cells = getCellsFromTable(tables[0]);
  var dataTables = tables.map(function(t) {
    return getCellsFromTable(t);
  });

  var currentTeam = "Liverpool";

  //find all teams we haven't played yet
  var teamsLeftToPlay = determineTeamsLeftToPlay(currentTeam, dataTables);

  var premTable = getPremierLeagueTable();

  var validNames = teamsLeftToPlay.map(function(team) {
    return getValidTeamNames().indexOf(team) === -1
      ? getInvalidNamePair("Bournemouth")
      : team;
  });

  //this isn't quite right - I need to create an index then go through all valid names and find their points
  //find name in premTable
  var combinedPoints = 0;
  traverseTables([premTable], {
    forEachRow: function(row) {
      if (row[0] !== currentTeam) {
        var opponentPoints = row[row.length - 1];
        combinedPoints += opponentPoints;
      }
    }
  });

  //now look up how many points they have

  //and repeat for every team

  var opp = getInvalidNamePair("Bournemouth");

  return cells;
}

function determineTeamsLeftToPlay(teamInQuestion, dataTables) {
  var teamsLeftToPlay = [];
  traverseTables(dataTables, {
    forEachRow: function(row) {
      if (row.indexOf("English Premier League") !== -1) {
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

function getPremierLeagueTable() {
  var url = "https://www.espn.com/soccer/table/_/league/eng.1";
  var html = UrlFetchApp.fetch(url).getContentText();
  var tables = html.match(/<table.*?<\/table>/gm);
  var teamTable = tables[0];
  var pointsTable = tables[1];
  var teamCells = getCellsFromTable(teamTable, {
    createCustomCell: function(cell) {
      return "something";
    }
  });
  var pointCells = getCellsFromTable(pointsTable);

  //combine cells
  var combinedCells = pointCells.slice();
  teamCells.forEach(function(cell, i) {
    combinedCells[i].unshift(cell[0]);
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
      "Team Name Missing - Check Script to Add to Array of Teams";
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

function getCellsFromTable(table) {
  var document = XmlService.parse(table);
  var root = document.getRootElement();
  var rows = root.getDescendants();
  rows = rows.filter(function(r) {
    return r.getName && r.getName() === "tr";
  });
  var cells = rows.map(function(r) {
    return r.getChildren("td").concat(r.getChildren("th"));
  });

  var createCustomCells = function(cell) {
    var links = cell.getDescendants().filter(function(d) {
      return d.getName && d.getName() === "a";
    });
    var hrefs = links.map(function(link) {
      return link.getAttribute("href");
    });

    return [hrefs[0]];
  };

  cells = cells.map(function(cellsArray) {
    //go through and add more cells if custom cells creator
    var processedCells = [];
    cellsArray.forEach(function(cell) {
      //add the cell as a string
      processedCells.push(c.getValue && c.getValue());

      //now run the custom cell creator to add additionalCells
      var customCells = createCustomCells(cell);
      processedCells = processedCells.concat(customCells);
    });

    return processedCells;
  });
  return cells;
}

function getValidTeamNames() {
  return [
    "Liverpool",
    "Leicester City",
    "Manchester City",
    "Chelsea",
    "Wolverhampton Wanderers",
    "Sheffield United",
    "Burnley",
    "Arsenal",
    "Manchester United",
    "Tottenham Hotspur",
    "Bournemouth",
    "Brighton & Hove Albion",
    "Crystal Palace",
    "Newcastle United",
    "Everton",
    "West Ham United",
    "Aston Villa",
    "Norwich City",
    "Southampton",
    "Watford"
  ];
}

function getInvalidNamePair(str) {
  return invalidNameMap()[str] || swap(invalidNameMap())[str];
}

function invalidNameMap() {
  return {
    "AFC Bournemouth": "Bournemouth"
  };
}

function swap(json) {
  var ret = {};
  for (var key in json) {
    ret[json[key]] = key;
  }
  return ret;
}
