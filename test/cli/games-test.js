/*
 * Copyright 2014, Gregg Tavares.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Gregg Tavares. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
"use strict";

var fs = require('fs');
var path = require('path');
var JSZip = require('jszip');
var utils = require('../../management/utils');

var g_configPath = path.join(__dirname, "..", "config", "config.json");
var g_installedGamesListPath = path.join(__dirname, "..", "config", "installed-games.json");
var g_fakeGamePath = path.join(__dirname, '..', 'fakegame');
var g_testGameInstallDir = path.join(__dirname, '..', 'testgameinstalldir');

var hftcli = function(cmd, args, callback) {
   utils.execute('node', [path.join(__dirname, "..", "..", "cli", "hft.js"), cmd, "--config-path=" + g_configPath].concat(args), function(err, result) {
     if (err != null) {
       console.log("cmd: " + cmd + " " + args.join(" "));
       console.log("stdout:" + result.stdout);
       console.log("stderr:" + result.stderr);
     }
     callback(err, result);
   });
};

var hftcliP = function(cmd, args) {
  return new Promise(function(fullfil, reject) {
    hftcli(cmd, args, function(err, result) {
      if (err != null) {
        reject(err);
      } else {
        fullfil(result);
      }
    });
  });
};

var getInstalledGames = function() {
  var content = fs.readFileSync(g_installedGamesListPath, {encoding: "utf-8"});
  return JSON.parse(content);
};

var assert = require("assert");
describe('games', function() {

  describe('list of installed games', function() {
    it('should not exist', function() {
      assert.ok(!fs.existsSync(g_installedGamesListPath));
    });

    it('should create empty list', function(done) {
      hftcli("init-game-list", [], function(err, result) {
        assert.equal(err, null);
        assert.ok(fs.existsSync(g_installedGamesListPath));
        assert.equal(getInstalledGames().length, 0);
        done();
      });
    });

    it('should list 0 game with empty list', function(done) {
      hftcli("list", ["--full"], function(err, result) {
        var list = JSON.parse(result.stdout);
        assert.equal(list.length, 0);
        done();
      });
    });

    it('should add game', function(done) {
      hftcli("add", [g_fakeGamePath], function(err, result) {
        assert.equal(err, null);
        assert.equal(getInstalledGames().length, 1);
        done();
      });
    });

    it('should list 1 game', function(done) {
      hftcli("list", ["--full"], function(err, result) {
        var list = JSON.parse(result.stdout);
        assert.equal(list.length, 1);
        assert.equal(list[0].happyFunTimes.gameId, "fakegame");
        done();
      });
    });

    it('should remove game', function(done) {
      hftcli("remove", [g_fakeGamePath], function(err, result) {
        assert.equal(err, null);
        assert.equal(getInstalledGames().length, 0);
        done();
      });
    });

    it('should list 0 game after removal', function(done) {
      hftcli("list", ["--full"], function(err, result) {
        assert.equal(err, null);
        var list = JSON.parse(result.stdout);
        assert.equal(list.length, 0);
        done();
      });
    });

    after(function() {
      utils.deleteNoFail(g_installedGamesListPath);
    });
  });
});

describe('release', function() {
  describe('making releases', function() {

    var destPath;
    var tempDir;

    before(function(done) {
      utils.getTempFolder().then(function(filePath) {
        tempDir = filePath;
        hftcli("init-game-list", [], function(err, result) {
          assert.equal(err, null);
          assert.ok(fs.existsSync(g_installedGamesListPath));
          assert.equal(getInstalledGames().length, 0);
          done();
        });
      });

    });

    it('should make a release', function(done) {
      hftcli('make-release', ["--src=" + g_fakeGamePath, tempDir, "--json"], function(err, result) {
        assert.equal(err, null);

        var files = JSON.parse(result.stdout);
        assert.equal(files.length, 1);
        destPath = files[0].filename;
        assert.ok(fs.existsSync(destPath));

        var zip = new JSZip();
        zip.load(fs.readFileSync(destPath));

        assert.ok(zip.files["fakegame/package.json"]);
        assert.ok(zip.files["fakegame/file1.html"]);
        assert.ok(zip.files["fakegame/somedir/file2.html"]);
        assert.ok(zip.files["fakegame/game.html"]);
        assert.ok(zip.files["fakegame/css/game.css"]);
        assert.ok(zip.files["fakegame/scripts/game.js"]);
        assert.ok(zip.files["fakegame/controller.html"]);
        assert.ok(zip.files["fakegame/css/controller.css"]);
        assert.ok(zip.files["fakegame/scripts/controller.js"]);
        assert.ok(zip.files["fakegame/icon.png"]);
        assert.ok(zip.files["fakegame/screenshot.png"]);

        done();
      });
    });

    it('should install release', function(done) {

      try {
        fs.mkdirSync(g_testGameInstallDir);
      } catch (e) {
      }

      hftcli('install', [destPath, "--verbose"], function(err, result) {
        assert.equal(err, null);

        assert.ok(fs.existsSync(path.join(g_testGameInstallDir, "fakegame")), "fakegame folder exists");
        assert.ok(fs.existsSync(path.join(g_testGameInstallDir, "fakegame", "package.json")), "package.json exists");
        assert.ok(fs.existsSync(path.join(g_testGameInstallDir, "fakegame", "file1.html")), "file1.html exists");
        assert.ok(fs.existsSync(path.join(g_testGameInstallDir, "fakegame", "somedir", "file2.html")), "file2.html exists");
        assert.ok(fs.existsSync(path.join(g_testGameInstallDir, "fakegame", "css", "game.css")));
        assert.ok(fs.existsSync(path.join(g_testGameInstallDir, "fakegame", "scripts", "game.js")));
        assert.ok(fs.existsSync(path.join(g_testGameInstallDir, "fakegame", "controller.html")));
        assert.ok(fs.existsSync(path.join(g_testGameInstallDir, "fakegame", "css", "controller.css")));
        assert.ok(fs.existsSync(path.join(g_testGameInstallDir, "fakegame", "scripts", "controller.js")));
        assert.ok(fs.existsSync(path.join(g_testGameInstallDir, "fakegame", "icon.png")));
        assert.ok(fs.existsSync(path.join(g_testGameInstallDir, "fakegame", "screenshot.png")));

        var gameList = getInstalledGames();
        assert.equal(gameList.length, 1);

        done();
      });
    });

    it('should uninstall game', function(done) {
      hftcli('uninstall', ["fakegame"], function(err, result) {
        assert.equal(err, null);
        assert.ok(!fs.existsSync(path.join(g_testGameInstallDir, "fakegame")));

        var gameList = getInstalledGames();
        assert.equal(gameList.length, 0);

        done();
      });
    });

    after(function() {
      utils.deleteNoFail(g_installedGamesListPath)
      utils.deleteNoFail(destPath);
    });
  });
});

