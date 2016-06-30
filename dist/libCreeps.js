var libCreeps = {

	updateMemory: function(spawn) {
		for(var name in Memory.creeps) {
			if(!Game.creeps[name]) {
				delete Memory.creeps[name];
			}
		}

		Memory.creeps.expected = {
			'harvester': 3,
			'carrier': 2,
			'upgrader': 2,
			'builder': 2
		};

		if (!Memory.creeps.current)
			Memory.creeps.current = {};
		for (var r in Memory.creeps.expected)
			Memory.creeps.current[r] = 0;
		var creeps = _.filter(Game.creeps, (c) => c.room == spawn.room);
		for (var c in creeps)
			Memory.creeps.current[creeps[c].memory.role]++;

		if (!spawn.room.memory.sources) {
			spawn.room.memory.sources = {};
			var sources = spawn.room.find(FIND_SOURCES);
			for (var s in sources) {
				spawn.room.memory.sources[s] = {};
				spawn.room.memory.sources[s].id = sources[s].id;
				spawn.room.memory.sources[s].pos = sources[s].pos;
			}
		}
	},

	manageConstructions: function(spawn) {
		if (!spawn.room.memory.extensions)
			spawn.room.memory.extensions = {};

		var nbExtensions = spawn.room.find(FIND_MY_STRUCTURES, {
			filter: { structureType: STRUCTURE_EXTENSION }
		}).length;
		if (spawn.room.controller.level >= 2 && nbExtensions < 5)
			this.createExtensions(spawn);
	},

	createExtensions: function(spawn) {
		spawn.room.createConstructionSite(spawn.pos.x-1, spawn.pos.y-2, STRUCTURE_EXTENSION);
		spawn.room.createConstructionSite(spawn.pos.x-2, spawn.pos.y-1, STRUCTURE_EXTENSION);
		spawn.room.createConstructionSite(spawn.pos.x-2, spawn.pos.y+1, STRUCTURE_EXTENSION);
		spawn.room.createConstructionSite(spawn.pos.x-1, spawn.pos.y+2, STRUCTURE_EXTENSION);
		spawn.room.createConstructionSite(spawn.pos.x+1, spawn.pos.y+2, STRUCTURE_EXTENSION);
	},

	managePopulation: function(spawn) {
		for (var r in Memory.creeps.expected) {
			if (Memory.creeps.current[r] < Memory.creeps.expected[r] && !spawn.spawning) {
				this.spawn(spawn, r);
				break;
			}
		}
	},

	spawn: function(spawn, role) {
		//console.log('libCreeps.spawn(' + spawn.name + ', ' + role + ')');
		var parts = [WORK, WORK, CARRY, MOVE];
		if (role == 'carrier')
			parts = [CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
		if (spawn.canCreateCreep(parts) == 0) {
			var name = spawn.createCreep(parts, null, { role: role, spawn: spawn.name });
			if (_.isString(name)) {
				console.log(spawn.name + ' spawned a new ' + role + ' with body ' + this.bodyPartsString(parts) + ' named ' + name);
			}
		}
	},

	bodyPartsString: function(parts) {
		var str = '[';
		for (var p in parts) {
			if (parts[p] == WORK) str += 'w';
			else if (parts[p] == CARRY) str += 'c';
			else if (parts[p] == MOVE) str += 'm';
			else str += '?';
		}
		str += ']';

		return str;
	},

	runCreeps: function() {
		for (var c in Game.creeps)
			this.runCreep(Game.creeps[c]);
	},

	runCreep: function(creep) {
		if (creep.ticksToLive == 1)
			console.log(creep.name + ' the ' + creep.memory.role + ' is dying');

		if (creep.spawning)
			return;

		if (creep.memory.role == 'harvester') this.harvesterActions(creep);
		else if (creep.memory.role == 'carrier') this.carrierActions(creep);
		else if (creep.memory.role == 'upgrader') this.upgraderActions(creep);
		else if (creep.memory.role == 'builder') this.builderActions(creep);
		else console.warn('Cannot determine which action to execute for creep ' + creep.name + ' which role is ' + creep.memory.role);
	},

	carrierActions: function(creep) {
		if (_.sum(creep.carry) < creep.carryCapacity) {
			//console.log(creep.name + ' the carrier is searching for energy');
			var destination = creep.pos.findClosestByPath(FIND_DROPPED_ENERGY);
			if (destination) {
				//console.log(creep.name + ' the carrier found dropped energy');
				if (creep.pickup(destination) == ERR_NOT_IN_RANGE)
					creep.moveTo(destination);
			}
			else {
				destination = creep.pos.findClosestByPath(FIND_MY_CREEPS, {
					filter: { memory.role == 'harvester' && _.sum(carry) > 0 }
				});
				creep.moveTo(destination);
			}
		}
		else {
			if (creep.transfer(Game.spawns[creep.memory.spawn], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE)
				creep.moveTo(Game.spawns[creep.memory.spawn]);
		}
	},

	harvesterActions: function(creep) {
		if (!creep.memory.harvesting && _.sum(creep.carry) == 0) {
			creep.memory.harvesting = true;
			var destination = creep.pos.findClosestByPath(FIND_SOURCES);
			creep.memory.destination = destination.pos;
			creep.memory.destinationId = destination.id;
			creep.memory.path = creep.pos.findPathTo(destination);
		}
		else if (creep.memory.harvesting && _.sum(creep.carry) >= creep.carryCapacity) {
			creep.memory.harvesting = false;
			creep.memory.destination = Game.spawns[creep.memory.spawn].pos;
			creep.memory.destinationId = Game.spawns[creep.memory.spawn].id;
			creep.memory.path = creep.pos.findPathTo(Game.spawns[creep.memory.spawn].pos);
		}

		var destination = Game.getObjectById(creep.memory.destinationId);
		if (!creep.pos.inRangeTo(destination, 1)) {
			var err = creep.moveTo(destination);
			//console.log(creep.name + ' is moving by path to ' + destination + ' : ' + err);
		}
		else if (creep.memory.harvesting) {
			var err = creep.harvest(destination);
			//console.log(creep.name + ' is harvesting (' + creep.memory.source + '): ' + err);
		}

		var foundCarrier = false;
		var carriers = _.filter(Game.creeps, (c) => c.memory.role == 'carrier');
		for (var c in carriers) {
			if (creep.pos.inRangeTo(carriers[c], 1)) {
				foundCarrier = true;
				//console.log(creep.name + ' is transferring to carrier ' + carriers[c].name);
				creep.transfer(carriers[c], RESOURCE_ENERGY);
			}
		}
		if (!foundCarrier) {
			var err = creep.transfer(destination, RESOURCE_ENERGY);
			//console.log(creep.name + ' is tranferring to (' + creep.memory.destinationId + '): ' + err);
		}
	},

	upgraderActions: function(creep) {
		if (_.sum(creep.carry) == 0) {
			var spawn = Game.spawns[creep.memory.spawn];
			if (spawn.transferEnergy(creep) == ERR_NOT_IN_RANGE)
				creep.moveTo(spawn);
		}
		else {
			var destination = creep.room.controller;
			if (creep.transfer(destination, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE)
				creep.moveTo(destination);
		}
	},

	builderActions: function(creep) {
		if (_.sum(creep.carry) == 0) {
			var spawn = Game.spawns[creep.memory.spawn];
			if (spawn.transferEnergy(creep) == ERR_NOT_IN_RANGE)
				creep.moveTo(spawn);
		}
		else {
			var destination = creep.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES);
			if (creep.build(destination) == ERR_NOT_IN_RANGE)
				creep.moveTo(destination);
		}
	}
};

module.exports = libCreeps;
