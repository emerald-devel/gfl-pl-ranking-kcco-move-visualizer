// Necessary? Probably not. But magic numbers and magic strings are disgusting and I like how easy this is to configure.
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

// Because individual global variables are disgusting but we still need global application state because passing a bunch of config values as function parameters throughout the entire call stack is even more disgusting.
const config = {
	scale: 0.25,
	width: 0,
	height: 0,
	offset_x: 0,
	offset_y: 0,
	radius: 100,
	margin: 50,
	highlight_path: null
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

function getNodesInHighlightPath() {
	// No node selected? Nothing in the path.
	if(config.highlight_path === null) {
		return [];
	}

	// Super simple: just start from the end node and travel backwards along the "from_node" values stored along each node.
	let current_node = config.highlight_path.end;
	let nodes = [current_node];
	while(current_node.hasOwnProperty('from_node')) {
		nodes.push(current_node.from_node);
		current_node = current_node.from_node;
	}

	return nodes;
}

function shouldHighlightPath(node1, node2) {
	// No node selected? Nothing to highlight.
	if(config.highlight_path === null) {
		return false;
	}

	let nodes = getNodesInHighlightPath();

	return nodes.indexOf(node1) >= 0 && nodes.indexOf(node2) >= 0;
}

function drawPath(node1, node2, is_one_way) {
	let from_x = calculateX(node1.coordinates[0]);
	let from_y = calculateY(node1.coordinates[1]);
	let to_x = calculateX(node2.coordinates[0]);
	let to_y = calculateY(node2.coordinates[1]);

	const canvas = document.getElementById('draw-space');
	const ctx = canvas.getContext('2d');
	ctx.beginPath();

	ctx.lineWidth = 20 * config.scale;
	ctx.strokeStyle = shouldHighlightPath(node1, node2) ? '#00FF00' : '#DDDDDD';
	ctx.moveTo(from_x, from_y);
	ctx.lineTo(to_x, to_y);

	// Draws a one-way path if necessary.
	if(is_one_way) {
		ctx.lineWidth = 15 * config.scale;
		const arrow_head_angle = Math.PI / 4;
		const arrow_head_length = 35 * config.scale;

		let delta_x = to_x - from_x;
		let delta_y = to_y - from_y;
		let angle = Math.atan2(delta_y, delta_x);

		let [x_inc, y_inc] = calculateArrowIncrements(from_x, from_y, to_x, to_y);
		let next_x = to_x;
		let next_y = to_y;

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

function updateCanvas() {
	const canvas = document.getElementById('draw-space');
	const ctx = canvas.getContext('2d');

	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = '#252525';
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	// Map connections.
	const node_map = {};
	const connection_map = {};
	for(let node of data) {
		node_map[node.id] = node;
		connection_map[node.id] = {};
		for(connection of node.route) {
			connection_map[node.id][connection] = 1;
		}
	}

	// Draw paths.
	for(let node of data) {
		for(connection of node.route) {
			let is_one_way = connection_map[connection][node.id] ? false : true;

			drawPath(node, node_map[connection], is_one_way);
		}
	};

	// Draw nodes.
	for(let [index, node] of data.entries()) {
		let highlight_node = getNodesInHighlightPath().indexOf(node) >= 0;
		ctx.beginPath();

		// Colorful highlighted borders for nodes in the prediction path.
		if(highlight_node) {
			let is_end_node = node === config.highlight_path.end;
			ctx.arc(calculateX(node.coordinates[0]), calculateY(node.coordinates[1]), config.radius + 4, 0, 2 * Math.PI, false);
			ctx.fillStyle = is_end_node ? '#FF00FF' : '#00FF00';
			ctx.fill();

			ctx.lineWidth = 4 * config.scale;
			ctx.strokeStyle = is_end_node ? '#FF00FF' : '#00FF00';
			ctx.stroke();
			ctx.beginPath();
		} else {
			ctx.lineWidth = 12 * config.scale;
			ctx.strokeStyle = '#252525';
		}

		// Actual map node.
		ctx.arc(calculateX(node.coordinates[0]), calculateY(node.coordinates[1]), config.radius, 0, 2 * Math.PI, false);
		ctx.fillStyle = faction_map[node.owner].color;
		ctx.fill();
		ctx.stroke();
		ctx.beginPath();

		// Occupation indicator.
		if(node.occupied) {
			ctx.arc(calculateX(node.coordinates[0]) + config.radius, calculateY(node.coordinates[1]) - 0.8*config.radius, 6, 0, 2 * Math.PI, false);
			ctx.fillStyle = faction_map[node.owner].color;
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
		if(node.owner === faction_map.GK.id) {
			if(node.type === 'heliport' || node.type === 'heavy heliport') {
				return node;
			}
		}
	}

	// Assumed: If no allied heliports, then allied nodes are highest priority.
	for(let node of nodes) {
		if(node.owner === faction_map.GK.id) {
			return node;
		}
	}

	// Assumed: If no allied nodes, then neutral heliports are highest priority.
	for(let node of nodes) {
		if(node.faction === faction_map.Neutral.id) {
			if(node.type === 'heliport' || node.type === 'heavy heliport') {
				return node;
			}
		}
	}

	// Assumed: If no allied nodes or neutral heliports, then first neutral node is highest priority.
	return nodes[0];
}

function calculateNextNodeMove(node) {
	// This function body could easily be replaced or re-adapted for lots of other AI behaviors. For now, this is being used for "expand" AI behavior from the KCCO faction only.

	// KCCO are greedy and lazy. If they don't already own the land they're standing on, they'll plant their asses on it and claim it as their own.
	if(node.owner !== faction_map.KCCO.id) {
		config.highlight_path = {
			start: node,
			end: node
		};
	} else {
		// Why a node map? Because performing excessive numbers of array searches drains my sanity.
		node_map = {};
		for(let next_node of data) {
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
						// By keeping track of which node first found this sibling, we can effectively cache the path of a BFS result for this particular node by traversing from the end node back to the beginning.
						node_map[sibling_id].from_node = visited_node;

						// If not occupied, then add the node to our list of candidates so we can check if it's a winner later.
						if(!is_first_pass || !node_map[sibling_id].occupied) {
							candidate_nodes.push(node_map[sibling_id]);
						}

						// Once we've located this unvisited sibling, we remove it from the node map, which effectively treats it as having been visited.
						node_map[sibling_id] = null;
						delete node_map[sibling_id];
					}
				}
			}

			// Now we filter out candidates that have already been capped by KCCO.
			let valid_candidates = candidate_nodes.filter((candidate) => {
				return candidate.owner !== faction_map.KCCO.id;
			});

			// If we have any valid candidates, then we can proceed with node selection, otherwise we need to take another pass at the next BFS depth.
			if(valid_candidates.length > 0) {
				destination = calculateNodePriority(valid_candidates);
			} else {
				nodes_visited = candidate_nodes;
			}

			is_first_pass = false;
		}

		// Found a match? Cool, add the start and end of the path. End node can be traversed backward to start node. Otherwise there's nothing to do.
		if(destination !== null) {
			config.highlight_path = {
				start: node,
				end: destination
			};
		}
	}

	updateCanvas();
}

window.addEventListener('DOMContentLoaded', (event) => {
	initConfig();

	const canvas = document.getElementById('draw-space');
	canvas.width = config.width;
	canvas.height = config.height;

	updateCanvas();

	canvas.addEventListener('mousedown', function(e) {
		// If we click anywhere, then we can assume that the current path is no longer needed. Clear it out.
		for(let node of data) {
			if(node.hasOwnProperty('from_node')) {
				node.from_node = null;
				delete node.from_node;
			}
		}

		config.highlight_path = null;

		// We only want to cycle node faction ownership if it's a left-click event. (Lol sorry mobile users, someone else can add touch support.)
		if(e.buttons === 1) {
			let [x, y] = getCursorPosition(canvas, e);
			for(let node of data) {
				// Fun fact: if the distance from your mouse to the center of a circle is less than or equal to the radius, then you're clicking inside of the circle.
				let distance = calculateNodeDistance(x, y, calculateX(node.coordinates[0]), calculateY(node.coordinates[1]));
				if(distance <= config.radius) {
					node.owner = (node.owner + 1) % factions.length;
				}
			}
		}

		updateCanvas();
	});

	canvas.addEventListener('mousemove', function(e) {
		// For adding a mouse pointer change when hovering over map nodes. Makes it easier to tell that it's actually interactable
		let [x, y] = getCursorPosition(canvas, e);
		let found = false;
		for(let node of data) {
			// Fun fact: if the distance from your mouse to the center of a circle is less than or equal to the radius, then you're hovering inside of the circle.
			let distance = calculateNodeDistance(x, y, calculateX(node.coordinates[0]), calculateY(node.coordinates[1]));
			if(distance <= config.radius) {
				canvas.style.cursor = 'pointer';
				found = true;
			}
		}

		if(!found) {
			canvas.style.cursor = 'default';
		}

		updateCanvas();
	});

	canvas.addEventListener('contextmenu', function(e) {
		let [x, y] = getCursorPosition(canvas, e);
		for(let node of data) {
			// Fun fact: if the distance from your mouse to the center of a circle is less than or equal to the radius, then you're clicking inside of the circle.
			let distance = calculateNodeDistance(x, y, calculateX(node.coordinates[0]), calculateY(node.coordinates[1]));
			if(distance <= config.radius) {
				e.preventDefault();

				// Hold Ctrl + right-click a node to toggle a node's status as occupied, or just right-click to calculate enemy pathing.
				if(e.ctrlKey) {
					if(node.hasOwnProperty('occupied')) {
						delete node.occupied;
					} else {
						node.occupied = true;
					}

					updateCanvas();
				} else {
					calculateNextNodeMove(node);
				}
			}
		}
	});
});
