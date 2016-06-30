var libCreeps = require('libCreeps');

module.exports.loop = function () {
	libCreeps.updateMemory(Game.spawns.Spawn1);
	libCreeps.managePopulation(Game.spawns.Spawn1);

	libCreeps.runCreeps();
}
