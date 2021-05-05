const factions = {
	Neutral: 3,
	GK: 1,
	KCCO: 2,
	Paradeus: 0
};

const faction_colors = [
	'#FFEE00',
	'#00EEFF',
	'#EE0000',
	'#FFFFFF'
];

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

	for(let node of data) {
		smallest_x = Math.min(smallest_x, node.coordinates[0]);
		smallest_y = Math.min(smallest_y, node.coordinates[1]);
		largest_x = Math.max(largest_x, node.coordinates[0]);
		largest_y = Math.max(largest_y, node.coordinates[1]);
	}

	let total_width = (largest_x - smallest_x) + 2 * config.margin;
	let total_height = (largest_y - smallest_y) + 2 * config.margin;
	let scale = Math.min((window.innerWidth - 2 * config.margin) / total_width, (window.innerHeight - 2 * config.margin) / total_height);

	config.scale = scale;
	config.radius = config.radius * config.scale;
	config.offset_x = -smallest_x * config.scale + config.margin;
	config.offset_y = -smallest_y * config.scale + config.margin;
	config.width = (largest_x - smallest_x) * config.scale + 2 * config.margin;
	config.height = (largest_y - smallest_y) * config.scale + 2 * config.margin;
}

function calculateNodeDistance(x1, y1, x2, y2) {
	return Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2));
}

function calculateX(x) {
	return config.offset_x + x * config.scale;
}

function calculateY(y) {
	return config.height - (config.offset_y + y * config.scale);
}

function calculateArrowIncrements(from_x, from_y, to_x, to_y) {
	const segment_length = 10;

	let line_length = calculateNodeDistance(from_x, from_y, to_x, to_y);
	let line_scale = segment_length / line_length;

	return [-(to_x - from_x) * line_scale, -(to_y - from_y) * line_scale];
}

function getNodesInHighlightPath() {
	if(config.highlight_path === null) {
		return [];
	}

	let current_node = config.highlight_path.end;
	let nodes = [current_node];
	while(current_node.hasOwnProperty('from_node')) {
		nodes.push(current_node.from_node);
		current_node = current_node.from_node;
	}

	return nodes;
}

function shouldHighlightPath(node1, node2) {
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

	const arrow_head_angle = Math.PI / 4;
	const arrow_head_length = 9;

	let delta_x = to_x - from_x;
	let delta_y = to_y - from_y;
	let angle = Math.atan2(delta_y, delta_x);

	const canvas = document.getElementById('draw-space');
	const ctx = canvas.getContext('2d');
	ctx.beginPath();

	ctx.lineWidth = 4;
	ctx.strokeStyle = shouldHighlightPath(node1, node2) ? '#00FF00' : '#DDDDDD';
	ctx.moveTo(from_x, from_y);
	ctx.lineTo(to_x, to_y);

	if(is_one_way) {
		let [x_inc, y_inc] = calculateArrowIncrements(from_x, from_y, to_x, to_y);
		let next_x = to_x;
		let next_y = to_y;
		while((next_x >= from_x && next_x <= to_x) || (next_x <= from_x && next_x >= to_x)) {
			ctx.moveTo(next_x, next_y);
			ctx.lineTo(next_x - arrow_head_length * Math.cos(angle - arrow_head_angle), next_y - arrow_head_length * Math.sin(angle - arrow_head_angle));
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
	for(let node of data) {
		let highlight_node = getNodesInHighlightPath().indexOf(node) >= 0;
		ctx.beginPath();

		if(highlight_node) {
			let is_end_node = node === config.highlight_path.end;
			ctx.arc(calculateX(node.coordinates[0]), calculateY(node.coordinates[1]), config.radius + 4, 0, 2 * Math.PI, false);
			ctx.fillStyle = is_end_node ? '#FF00FF' : '#00FF00';
			ctx.fill();

			ctx.lineWidth = 3;
			ctx.strokeStyle = is_end_node ? '#FF00FF' : '#00FF00';
			ctx.stroke();
			ctx.beginPath();
		}

		ctx.arc(calculateX(node.coordinates[0]), calculateY(node.coordinates[1]), config.radius, 0, 2 * Math.PI, false);
		ctx.fillStyle = faction_colors[node.owner];
		ctx.fill();

		ctx.lineWidth = 3;
		ctx.strokeStyle = '#252525';
		ctx.fillStyle = '#252525';
		ctx.textAlign = 'center';
		ctx.font = 'bold ' + Math.floor(config.radius * 0.7) + 'pt Arial';
		ctx.fillText(node.friendly_id, calculateX(node.coordinates[0]), calculateY(node.coordinates[1]) + config.radius * 0.32);
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
		if(node.owner === factions.GK) {
			if(node.type === 'heliport' || node.type === 'heavy heliport') {
				return node;
			}
		}
	}

	// Assumed: If no allied heliports, then allied nodes are highest priority.
	for(let node of nodes) {
		if(node.owner === factions.GK) {
			return node;
		}
	}

	// Assumed: If no allied nodes, then neutral heliports are highest priority.
	for(let node of nodes) {
		if(node.faction === factions.Neutral) {
			if(node.type === 'heliport' || node.type === 'heavy heliport') {
				return node;
			}
		}
	}

	// Assumed: If no allied nodes or neutral heliports, then first neutral node is highest priority.
	return nodes[0];
}

function calculateNextNodeMove(node) {
	if(node.owner !== factions.KCCO) {
		config.highlight_path = {
			start: node,
			end: node
		};
	} else {
		node_map = {};
		for(let next_node of data) {
			if(node.id === next_node.id) {
				continue;
			}

			node_map[next_node.id] = next_node;
		}

		let nodes_visited = [node];
		let destination = null;

		while(destination === null && nodes_visited.length > 0) {
			let candidate_nodes = [];
			for(let visited_node of nodes_visited) {
				for(let sibling_id of visited_node.route) {
					if(node_map.hasOwnProperty(sibling_id)) {
						node_map[sibling_id].from_node = visited_node;
						candidate_nodes.push(node_map[sibling_id]);
						node_map[sibling_id] = null;
						delete node_map[sibling_id];
					}
				}
			}

			let valid_candidates = [];
			for(let candidate of candidate_nodes) {
				if(candidate.owner !== factions.KCCO) {
					valid_candidates.push(candidate);
				}
			}

			if(valid_candidates.length > 0) {
				destination = calculateNodePriority(valid_candidates);
			} else {
				nodes_visited = candidate_nodes;
			}
		}

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
		for(let node of data) {
			if(node.hasOwnProperty('from_node')) {
				node.from_node = null;
				delete node.from_node;
			}
		}

		config.highlight_path = null;

		if(e.buttons !== 1) {
			return;
		}

		let [x, y] = getCursorPosition(canvas, e);
		for(let node of data) {
			let distance = calculateNodeDistance(x, y, calculateX(node.coordinates[0]), calculateY(node.coordinates[1]));
			if(distance <= config.radius) {
				node.owner = (node.owner + 1) % faction_colors.length;
			}
		}

		updateCanvas();
	});

	canvas.addEventListener('mousemove', function(e) {
		let [x, y] = getCursorPosition(canvas, e);
		let found = false;
		for(let node of data) {
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
		let found = false;
		for(let node of data) {
			let distance = calculateNodeDistance(x, y, calculateX(node.coordinates[0]), calculateY(node.coordinates[1]));
			if(distance <= config.radius) {
				e.preventDefault();
				calculateNextNodeMove(node);
			}
		}
	});
});