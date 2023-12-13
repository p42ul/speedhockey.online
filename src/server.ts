import { TICKRATE_MS, ARENA_WIDTH, ARENA_HEIGHT, PUCK_RADIUS, PADDLE_RADIUS, MAX_PLAYER_MOVE_DISTANCE } from "./constants";
import { Bodies, Composite, Engine, Body, Constraint, Vector } from "matter-js";
import { Server } from "socket.io";


const engine = Engine.create({ gravity: { y: 0 } });
const wall_thickness = 50;

const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>({
    cors: {
        origin: process.env.CORS_ORIGIN,
        methods: ["GET", "POST"]
    }
});


let puck = Bodies.circle(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, PUCK_RADIUS, {
    friction: 0,
    frictionAir: 0.0075,
    restitution: 1.0,
    mass: 20.0,
});

let player1 = Bodies.circle(0+PADDLE_RADIUS, ARENA_HEIGHT / 2, PADDLE_RADIUS, { isStatic: true });
let player2 = Bodies.circle(ARENA_WIDTH-PADDLE_RADIUS, ARENA_HEIGHT / 2, PADDLE_RADIUS, { isStatic: true });


let ground = Bodies.rectangle(ARENA_WIDTH / 2, ARENA_HEIGHT + wall_thickness / 2, ARENA_WIDTH, wall_thickness, { isStatic: true });
let ceiling = Bodies.rectangle(ARENA_WIDTH / 2, -wall_thickness / 2, ARENA_WIDTH, wall_thickness, { isStatic: true });

Composite.add(engine.world, [puck, ground, ceiling, player1, player2]);


let _state: GameState = {
    puckPos: puck.position,
    player1Pos: player1.position,
    player2Pos: player2.position,
    redScore: 0,
    bluScore: 0,
};

io.on("connect", (socket) => {
    socket.on("updatePosition", (pos: Vector2, player: number) => {
        const currentPlayer = player == 0 ? player1 : player2;

        const deltaX = pos.x - currentPlayer.position.x;
        const deltaY = pos.y - currentPlayer.position.y;
        const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2);

        if (distance > MAX_PLAYER_MOVE_DISTANCE) {
            const directionX = deltaX / distance;
            const directionY = deltaY / distance;
            const newX = currentPlayer.position.x + directionX * MAX_PLAYER_MOVE_DISTANCE;
            const newY = currentPlayer.position.y + directionY * MAX_PLAYER_MOVE_DISTANCE;
            // @ts-ignore (needed because type definitions for MatterJS are not correct)
            Body.setPosition(currentPlayer, { x: newX, y: newY }, true);
        } else {
            // @ts-ignore (needed because type definitions for MatterJS are not correct)
            Body.setPosition(currentPlayer, pos, true);
        }
        pos.y = clamp(pos.y, 0, ARENA_HEIGHT);
    })
})

function resetPuck() {
    Body.setPosition(puck, { x: ARENA_WIDTH / 2, y: Math.random() * ARENA_HEIGHT });
    Body.setVelocity(puck, { x: 0, y: 0 });
    Body.setAngularSpeed(puck, 0);
}

function clamp(val: number, low: number, high: number): number {
    return Math.max(Math.min(val, high), low);
}

function tick(dt: number) {
    Engine.update(engine, dt);
    if (puck.position.x < 0) {
        resetPuck();
        _state.bluScore += 1;
    }
    if (puck.position.x > ARENA_WIDTH) {
        resetPuck();
        _state.redScore += 1;
    }
    puck.position.y = clamp(puck.position.y, 0, ARENA_HEIGHT);
    _state.puckPos = puck.position;
    _state.player1Pos = player1.position;
    _state.player2Pos = player2.position;
    io.emit("updateGameState", _state);
}

setInterval(tick, TICKRATE_MS);

console.log("running on port 3000...");
io.listen(3000);