// Necessary? Probably not. But magic numbers and magic strings are disgusting and I like how easy this is to configure.
const node_types = {
	1: 'hq',
	2: 'normal',
	3: 'heliport',
	5: 'crate',
	7: 'heavy heliport'
};

// Necessary? Probably not. But magic numbers and magic strings are disgusting and I like how easy this is to configure. Yes, it's a copy-pasta of the above comment, get over it.
const factions = [
	{
		id: 3,
		name: 'Neutral',
		color: '#FFFFFF'
	},
	{
		id: 1,
		name: 'GK',
		color: '#00EEFF'
	},
	{
		id: 2,
		name: 'KCCO',
		color: '#EE0000'
	},
	{
		id: 0,
		name: 'Paradeus',
		color: '#FFEE00'
	}
];

// Because repeated array searches are disgusting and I don't want to write multiple functions to grab a color or compare IDs.
const faction_map = factions.reduce((map, faction) => {
	map[faction.name] = faction;
	map[faction.id] = faction;
	return map;
}, {});

// Transform the data into something a little more usable.
const data = raw_data.map((node) => {
	node.route = node.route.split(',');
	node.friendly_id = id_map[node.id];
	node.coordinates = [node.coordinator_x, node.coordinator_y];
	node.occupied = node.ally_team_id > 0 ? 2 : (node.enemy_team_id > 0 ? 1 : 0);
	node.occupied = node.belong !== faction_map.GK.id ? node.occupied : 0;
	node.ally_occupied = node.ally_team_id > 0 && node.belong === faction_map.GK.id ? 1 : 0;

	return node;
});

// Because individual global variables are disgusting but we still need global application state because passing a bunch of config values as function parameters throughout the entire call stack is even more disgusting.
const config = {
	scale: 0.25,
	width: 0,
	height: 0,
	offset_x: 0,
	offset_y: 0,
	radius: 100,
	margin: 50,
	turn: 1,
	calculate_button: {
		position: [-350, -1000],
		width: 1000,
		height: 250,
		scale: 1,
		color: '#EE9933'
	}
};

function initConfig() {
	let smallest_x, smallest_y, largest_x, largest_y;
	[smallest_x, smallest_y] = [largest_x, largest_y] = data[0].coordinates;

	// We need to know the bounding box of the node coordinates.
	for(let node of data) {
		smallest_x = Math.min(smallest_x, node.coordinates[0]);
		smallest_y = Math.min(smallest_y, node.coordinates[1]);
		largest_x = Math.max(largest_x, node.coordinates[0]);
		largest_y = Math.max(largest_y, node.coordinates[1]);
	}

	// The actual coordinate range is too large to reasonably represent at 1:1 scale, so we want to scale it down. We may as well make it fit the user's viewport while we're at it. (Lol sorry mobile users.)
	let total_width = (largest_x - smallest_x) + 2 * config.margin;
	let total_height = (largest_y - smallest_y) + 2 * config.margin;
	let scale = Math.min((window.innerWidth - 2 * config.margin) / total_width, (window.innerHeight - 2 * config.margin) / total_height);

	// Set up various helper config values so we don't have to use a bunch of magic numbers like idiots.
	config.scale = scale;
	config.radius = config.radius * config.scale;
	config.offset_x = -smallest_x * config.scale + config.margin;
	config.offset_y = -smallest_y * config.scale + config.margin;
	config.width = (largest_x - smallest_x) * config.scale + 2 * config.margin;
	config.height = (largest_y - smallest_y) * config.scale + 2 * config.margin;
}

function exportMapState() {
	return config.turn + '::' + data.map((node) => [id_map[node.id], node.belong, node.occupied].join(':')).join(',');
}

function importMapState(state) {
	let node_map = {};
	for(let node of data) {
		node.occupied = 0;
		node_map[id_map[node.id]] = node;
	}

	if(state.split('::').length > 1) {
		[config.turn, state] = state.split('::');
		config.turn = parseInt(config.turn);
	} else {
		config.turn = 1;
	}

	for(let node_state of state.split(',')) {
		let [node_name, owner, occupation] = node_state.split(':');
		node_name = node_name.toUpperCase();
		owner = parseInt(owner);
		occupation = parseInt(occupation);

		node_map[node_name].belong = owner;
		node_map[node_name].occupied = occupation;
	}

	updateCanvas(data);
}

function calculateNodeDistance(x1, y1, x2, y2) {
	// a^2 + b^2 = c^2; thanks, math!
	return Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2));
}

function calculateX(x) {
	return config.offset_x + x * config.scale;
}

function calculateY(y) {
	// Y values are inverted, so we need to subtract from the canvas height to flip them.
	return config.height - (config.offset_y + y * config.scale);
}

function calculateArrowIncrements(from_x, from_y, to_x, to_y) {
	const segment_length = 40 * config.scale;

	let line_length = calculateNodeDistance(from_x, from_y, to_x, to_y);
	let line_scale = segment_length / line_length;

	// Haven't bothered to properly think over if this is accurate or not, but it works well enough for now. If it needs to be changed, then some trig would probably help.
	return [-(to_x - from_x) * line_scale, -(to_y - from_y) * line_scale];
}

function drawPath(node1, node2, is_one_way) {
	let highlight = (node2.hasOwnProperty('from_node') && node2.from_node === node1) || (node1.hasOwnProperty('from_node') && node1.from_node === node2);
	if(highlight && node1.hasOwnProperty('from_node') && node1.from_node === node2) {
		let temp = node1;
		node1 = node2;
		node2 = node1;
	}

	let from_x = calculateX(node1.coordinates[0]);
	let from_y = calculateY(node1.coordinates[1]);
	let to_x = calculateX(node2.coordinates[0]);
	let to_y = calculateY(node2.coordinates[1]);

	const arrow_head_angle = Math.PI / 4;
	const arrow_head_length = 35 * config.scale;

	const canvas = document.getElementById('draw-space');
	const ctx = canvas.getContext('2d');
	ctx.beginPath();

	ctx.lineWidth = 20 * config.scale;
	ctx.strokeStyle = highlight ? '#00DD00' : '#DDDDDD';
	ctx.moveTo(from_x, from_y);
	ctx.lineTo(to_x, to_y);

	let delta_x = to_x - from_x;
	let delta_y = to_y - from_y;
	let angle = Math.atan2(delta_y, delta_x);
	let [x_inc, y_inc] = calculateArrowIncrements(from_x, from_y, to_x, to_y);

	// Draws a one-way path if necessary.
	if(is_one_way || highlight) {
		ctx.lineWidth = 15 * config.scale;

		let next_x = to_x;
		let next_y = to_y;

		if(highlight) {
			x_inc *= 3;
			y_inc *= 3;
		}

		// A one-way path is basically just a bunch of arrow heads along the length of the path. Just place them within a reasonable distance of each other until you've covered the path.
		while((next_x >= from_x && next_x <= to_x) || (next_x <= from_x && next_x >= to_x)) {
			ctx.stroke();

			ctx.beginPath();
			ctx.moveTo(next_x, next_y);
			ctx.lineTo(next_x - arrow_head_length * Math.cos(angle - arrow_head_angle), next_y - arrow_head_length * Math.sin(angle - arrow_head_angle));
			ctx.stroke();

			ctx.beginPath();
			ctx.moveTo(next_x, next_y);
			ctx.lineTo(next_x - arrow_head_length * Math.cos(angle + arrow_head_angle), next_y - arrow_head_length * Math.sin(angle + arrow_head_angle));

			next_x += x_inc;
			next_y += y_inc;
		}
	}

	ctx.stroke();
}

function updateCanvas(nodes) {
	const canvas = document.getElementById('draw-space');
	const ctx = canvas.getContext('2d');

	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = '#252525';
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	// Map connections.
	const node_map = {};
	const connection_map = {};
	for(let node of nodes) {
		node_map[node.id] = node;
		connection_map[node.id] = {};
		for(connection of node.route) {
			connection_map[node.id][connection] = 1;
		}
	}

	// Draw paths.
	for(let node of nodes) {
		for(connection of node.route) {
			let is_one_way = connection_map[connection][node.id] ? false : true;

			drawPath(node, node_map[connection], is_one_way);
		}
	};

	// Draw nodes.
	for(let [index, node] of nodes.entries()) {
		ctx.beginPath();

		// Actual map node.
		ctx.lineWidth = 12 * config.scale;
		ctx.strokeStyle = '#252525';
		ctx.arc(calculateX(node.coordinates[0]), calculateY(node.coordinates[1]), config.radius, 0, 2 * Math.PI, false);
		ctx.fillStyle = faction_map[node.belong].color;
		ctx.fill();
		ctx.stroke();
		ctx.beginPath();

		// Occupation indicator.
		if(node.occupied) {
			ctx.arc(calculateX(node.coordinates[0]) + config.radius, calculateY(node.coordinates[1]) - 0.8*config.radius, 0.2 * node.occupied * config.radius, 0, 2 * Math.PI, false);
			ctx.fillStyle = node.belong === faction_map.Paradeus.id ? faction_map.Paradeus.color : faction_map.KCCO.color;
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
		}

		// Ally occupation indicator.
		if(node.ally_occupied) {
			ctx.arc(calculateX(node.coordinates[0]) - config.radius, calculateY(node.coordinates[1]) - 0.8*config.radius, 0.2 * node.ally_occupied * config.radius, 0, 2 * Math.PI, false);
			ctx.fillStyle = faction_map.GK.color;
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
		}

		ctx.fillStyle = '#252525';
		ctx.textAlign = 'center';

		// Our user-friendly reference node IDs e.g. K6.
		ctx.font = 'bold ' + Math.floor(config.radius * 0.7) + 'pt Arial';
		ctx.fillText(node.friendly_id, calculateX(node.coordinates[0]), calculateY(node.coordinates[1]) + config.radius * 0.32);
		ctx.stroke();

		// The node's positions in the JSON array. Might not be required, but could be useful in case node movement order is based on array ordering.
		ctx.beginPath();
		ctx.font = 'bold ' + Math.floor(config.radius * 0.35) + 'pt Arial';
		ctx.fillText('#' + (index + 1), calculateX(node.coordinates[0]), calculateY(node.coordinates[1]) + config.radius * 0.8);

		ctx.stroke();
		ctx.beginPath();

		// It's a button. A big, orange button.
		ctx.fillStyle = config.calculate_button.color;
		ctx.fillRect(
			calculateX(config.calculate_button.position[0]),
			calculateY(config.calculate_button.position[1]),
			config.calculate_button.width * config.calculate_button.scale * config.scale,
			config.calculate_button.height * config.calculate_button.scale * config.scale
		);

		ctx.strokeStyle = '#252525';
		ctx.fillStyle = '#252525';
		ctx.font = Math.floor(config.radius) + 'pt Arial';
		ctx.fillText('Calculate Moves',
			calculateX(config.calculate_button.position[0]) + config.calculate_button.width * config.scale / 2,
			calculateY(config.calculate_button.position[1]) + 1.35 * config.calculate_button.height * config.scale / 2
		);

		ctx.stroke();
		ctx.beginPath();

		// It's another button. Another big, orange button.
		ctx.fillStyle = config.calculate_button.color;
		ctx.fillRect(
			calculateX(config.calculate_button.position[0]) + 0.25 * config.calculate_button.width * config.calculate_button.scale * config.scale / 2,
			calculateY(config.calculate_button.position[1]) - config.calculate_button.height * config.calculate_button.scale * config.scale,
			config.calculate_button.width * 0.75 * config.calculate_button.scale * config.scale,
			config.calculate_button.height * 0.75 * config.calculate_button.scale * config.scale
		);

		ctx.strokeStyle = '#252525';
		ctx.fillStyle = '#252525';
		ctx.font = Math.floor(0.75 * config.radius) + 'pt Arial';
		ctx.fillText('Turn: ' + config.turn,
			calculateX(config.calculate_button.position[0]) + 0.01 * config.calculate_button.width * config.calculate_button.scale * config.scale / 2 + config.calculate_button.width * config.scale / 2,
			calculateY(config.calculate_button.position[1]) - 1.15 * config.calculate_button.height * config.calculate_button.scale * config.scale + 1.35 * config.calculate_button.height * config.scale / 2
		);

		ctx.stroke();
	}
}

function getCursorPosition(canvas, event) {
	const rect = canvas.getBoundingClientRect();
	const x = event.clientX - rect.left;
	const y = event.clientY - rect.top;

	return [x, y];
}

function calculateNodePriority(nodes) {
	// Assumed: Allied heliports are highest priority.
	for(let node of nodes) {
		if(node.belong === faction_map.GK.id) {
			if(node_types[node.type] === 'heliport' || node_types[node.type] === 'heavy heliport') {
				return node;
			}
		}
	}

	// Assumed: If no allied heliports, then allied nodes are highest priority.
	for(let node of nodes) {
		if(node.belong === faction_map.GK.id) {
			return node;
		}
	}

	// If for whatever reason the first two passes failed, return the first node available. Should never happen, but you never know.
	return nodes[0];
}

function calculateNextNodeMove(node, nodes) {
	// This function body could easily be replaced or re-adapted for lots of other AI behaviors. For now, this is being used for "expand" AI behavior from the KCCO faction only.

	// KCCO are greedy and lazy. If they don't already own the land they're standing on, they'll plant their asses on it and claim it as their own.
	if(node.belong !== faction_map.KCCO.id) {
		return node;
	}

	// Why a node map? Because performing excessive numbers of array searches drains my sanity.
	node_map = {};
	for(let next_node of nodes) {
		if(node.id === next_node.id) {
			continue;
		}

		node_map[next_node.id] = next_node;
	}

	let nodes_visited = [node];
	let destination = null;
	let is_first_pass = true;

	// Breadth-first search. Keep going until either we find a solution or run out of options (in reality this would never happen, but prevents infinite loops when testing or fucking around with the map by marking all nodes as capped by KCCO).
	while(destination === null && nodes_visited.length > 0) {
		// Find all nodes at BFS depth + 1, i.e. all unvisited nodes directly adjacent to our visited nodes list.
		let candidate_nodes = [];
		for(let visited_node of nodes_visited) {
			for(let sibling_id of visited_node.route) {
				// A sibling node hasn't been visited if it's still in our node map.
				if(node_map.hasOwnProperty(sibling_id)) {
					let sibling_node = node_map[sibling_id];

					// Once we've located this unvisited sibling, we remove it from the node map, which effectively treats it as having been visited.
					node_map[sibling_id] = null;
					delete node_map[sibling_id];

					// By keeping track of which node first found this sibling, we can effectively cache the path of a BFS result for this particular node by traversing from the end node back to the beginning.
					sibling_node.prev_node = visited_node;

					// If not occupied, then add the node to our list of candidates so we can check if it's a winner later.
					if(!is_first_pass || !sibling_node.occupied) {
						candidate_nodes.push(sibling_node);
					}
				}
			}
		}

		// Now we filter out candidates that have already been capped by KCCO.
		let valid_candidates = candidate_nodes.filter((candidate) => {
			return candidate.belong === faction_map.GK.id;
		});

		// If we have any valid candidates, then we can proceed with node selection, otherwise we need to take another pass at the next BFS depth.
		if(valid_candidates.length > 0) {
			destination = calculateNodePriority(valid_candidates);
		} else {
			nodes_visited = candidate_nodes;
		}

		is_first_pass = false;
	}

	// Found a match? Cool, now find the very first node along the path for a mob to move to.
	if(destination !== null) {
		while(destination.prev_node !== node) {
			destination = destination.prev_node;
		}
	}

	for(let next_node of nodes) {
		if(next_node.hasOwnProperty('prev_node')) {
			next_node.prev_node = null;
			delete next_node.prev_node;
		}
	}

	return destination;
}

function calculateEnemyMoveTurn(data_set) {
	// First, spawn mobs on helipads.
	data_set.filter((node) => node.belong === faction_map.KCCO.id && (node.type === 3 || node.type === 7) && !node.occupied).map((node) => {
		let occupied = 1;
		if(node.active_cycle) {
			let [closed, open] = node.active_cycle.split(',').map((number) => parseInt(number));
			let current_turn = 0;
			while(true) {
				current_turn += closed;
				if(current_turn >= config.turn) {
					occupied = 0;
					break;
				}

				current_turn += open;
				if(current_turn >= config.turn) {
					occupied = 1;
					break;
				}
			}
		}

		node.occupied = occupied;
	});

	// First pass, calculate normal enemy mob movement. Second pass, calculate deathstack movement.
	for(let enemy_type of [1, 2]) {
		let enemies_of_type = data_set.filter((node) => {
			return node.belong === faction_map.KCCO.id && node.occupied === enemy_type;
		});

		for(let node of enemies_of_type) {
			let target_node = calculateNextNodeMove(node, data_set);

			if(target_node === null) {
				continue;
			}

			target_node.occupied = node.occupied;
			node.occupied = 0;
			target_node.from_node = node;
		}
	}
}

window.addEventListener('DOMContentLoaded', (event) => {
	initConfig();

	const canvas = document.getElementById('draw-space');
	canvas.width = config.width;
	canvas.height = config.height;

	updateCanvas(data);

	canvas.addEventListener('mousedown', function(e) {
		// We only want to cycle node faction ownership if it's a left-click event. (Lol sorry mobile users, someone else can add touch support.)
		if(e.buttons === 1) {
			let [x, y] = getCursorPosition(canvas, e);
			let found = false;
			for(let node of data) {
				// Fun fact: if the distance from your mouse to the center of a circle is less than or equal to the radius, then you're clicking inside of the circle.
				let distance = calculateNodeDistance(x, y, calculateX(node.coordinates[0]), calculateY(node.coordinates[1]));
				if(distance <= config.radius) {
					node.belong = (node.belong + 1) % factions.length;
					found = true;
				}
			}

			// Maybe the calculate button was clicked instead.
			if(!found) {
				let x_min = calculateX(config.calculate_button.position[0]);
				let x_max = x_min + config.calculate_button.width * config.calculate_button.scale * config.scale;
				let y_min = calculateY(config.calculate_button.position[1]);
				let y_max = y_min + config.calculate_button.height * config.calculate_button.scale * config.scale;

				// Oh, it was clicked? Then make shit happen.
				if(x >= x_min && x <= x_max && y >= y_min && y <= y_max) {
					let data_copy = JSON.parse(JSON.stringify(data));
					calculateEnemyMoveTurn(data_copy);
					updateCanvas(data_copy);
					return;
				}
			}

			// Maybe the turn button was clicked instead.
			if(!found) {
				let x_min = calculateX(config.calculate_button.position[0]) + 0.25 * config.calculate_button.width * config.calculate_button.scale * config.scale / 2;
				let x_max = x_min + 0.75 * config.calculate_button.width * config.calculate_button.scale * config.scale;
				let y_min = calculateY(config.calculate_button.position[1]) - config.calculate_button.height * config.calculate_button.scale * config.scale;
				let y_max = y_min + 0.75 * config.calculate_button.height * config.calculate_button.scale * config.scale;

				if(x >= x_min && x <= x_max && y >= y_min && y <= y_max) {
					config.turn = (config.turn + 1) % 9;
					if(config.turn === 0) {
						config.turn = 1;
					}

					found = true;
				}
			}
		}

		updateCanvas(data);
	});

	canvas.addEventListener('mousemove', function(e) {
		// For adding a mouse pointer change when hovering over map nodes. Makes it easier to tell that it's actually interactable
		let [x, y] = getCursorPosition(canvas, e);
		let found = false;
		for(let node of data) {
			// Fun fact: if the distance from your mouse to the center of a circle is less than or equal to the radius, then you're hovering inside of the circle.
			let distance = calculateNodeDistance(x, y, calculateX(node.coordinates[0]), calculateY(node.coordinates[1]));
			if(distance <= config.radius) {
				found = true;
			}
		}

		// Maybe the calculate button is being hovered over instead.
		if(!found) {
			let x_min = calculateX(config.calculate_button.position[0]);
			let x_max = x_min + config.calculate_button.width * config.calculate_button.scale * config.scale;
			let y_min = calculateY(config.calculate_button.position[1]);
			let y_max = y_min + config.calculate_button.height * config.calculate_button.scale * config.scale;

			if(x >= x_min && x <= x_max && y >= y_min && y <= y_max) {
				found = true;
			}
		}

		// Maybe the turn button is being hovered over instead.
		if(!found) {
			let x_min = calculateX(config.calculate_button.position[0]) + 0.25 * config.calculate_button.width * config.calculate_button.scale * config.scale / 2;
			let x_max = x_min + 0.75 * config.calculate_button.width * config.calculate_button.scale * config.scale;
			let y_min = calculateY(config.calculate_button.position[1]) - config.calculate_button.height * config.calculate_button.scale * config.scale;
			let y_max = y_min + 0.75 * config.calculate_button.height * config.calculate_button.scale * config.scale;

			if(x >= x_min && x <= x_max && y >= y_min && y <= y_max) {
				found = true;
			}
		}

		canvas.style.cursor = found ? 'pointer' : 'default';
	});

	canvas.addEventListener('contextmenu', function(e) {
		let [x, y] = getCursorPosition(canvas, e);
		for(let node of data) {
			// Fun fact: if the distance from your mouse to the center of a circle is less than or equal to the radius, then you're clicking inside of the circle.
			let distance = calculateNodeDistance(x, y, calculateX(node.coordinates[0]), calculateY(node.coordinates[1]));
			if(distance <= config.radius) {
				e.preventDefault();

				let property_name = e.ctrlKey ? 'ally_occupied' : 'occupied';

				// Right-clicking a node toggles between unoccupied, occupied by normal mob, and occupied by deathstack.
				if(node.hasOwnProperty(property_name)) {
					node[property_name] = (node[property_name] + 1) % 3;
				} else {
					node[property_name] = 1;
				}

				updateCanvas(data);
			}
		}
	});

	document.addEventListener('copy', function(e) {
		e.preventDefault();
		navigator.clipboard.writeText(exportMapState());
	});

	document.addEventListener('paste', function(e) {
		let state = (e.clipboardData || window.clipboardData).getData('text');
		if(/^(\d::)?([A-Za-z]\d+:\d:\d,)*([A-Za-z]\d+:\d:\d)$/.test(state)) {
			importMapState(state);
			updateCanvas(data);
		}
	});
});
