import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
export function Lobby({ room, onCreate, onStart, onJoin }) {
    const [selectedMission, setSelectedMission] = useState(1);
    const [joinCode, setJoinCode] = useState('');
    const handleCreate = () => {
        onCreate(selectedMission);
    };
    const handleJoin = () => {
        onJoin?.(joinCode);
    };
    if (!room) {
        return (_jsxs("div", { style: { padding: '24px', fontFamily: 'system-ui' }, children: [
            _jsx("h1", { children: "Space Crew Lobby" }),
            _jsx("p", { children: "No room yet. Create one to start playing!" }),
            _jsxs("div", { style: { marginBottom: '24px', padding: '16px', backgroundColor: '#f9f9f9', borderRadius: '4px' }, children: [
                _jsx("h2", { children: "Create New Room" }),
                _jsxs("div", { style: { marginBottom: '16px' }, children: [
                    _jsx("label", { htmlFor: "mission-select", style: { marginRight: '8px' }, children: "Mission:" }),
                    _jsx("select", { id: "mission-select", "data-testid": "mission-select", value: selectedMission, onChange: (e) => setSelectedMission(Number(e.target.value)), style: { padding: '8px', fontSize: '16px' }, children: Array.from({ length: 50 }, (_, i) => i + 1).map((mission) => (_jsx("option", { value: mission, children: mission }, mission))) })
                ] }),
                _jsx("button", { onClick: handleCreate, style: { padding: '8px 16px', fontSize: '16px', cursor: 'pointer' }, children: "방 만들기" })
            ] }),
            _jsxs("div", { style: { marginBottom: '24px', padding: '16px', backgroundColor: '#f9f9f9', borderRadius: '4px' }, children: [
                _jsx("h2", { children: "Join Existing Room" }),
                _jsxs("div", { style: { marginBottom: '16px' }, children: [
                    _jsx("label", { htmlFor: "join-code", style: { marginRight: '8px' }, children: "Room Code:" }),
                    _jsx("input", { id: "join-code", "data-testid": "join-code-input", type: "text", value: joinCode, onChange: (e) => setJoinCode(e.target.value), placeholder: "Enter room code", style: { padding: '8px', fontSize: '16px' } })
                ] }),
                _jsx("button", { onClick: handleJoin, disabled: !joinCode.trim(), style: { padding: '8px 16px', fontSize: '16px', cursor: joinCode.trim() ? 'pointer' : 'not-allowed', opacity: joinCode.trim() ? 1 : 0.5 }, children: "합류" })
            ] })
        ] }));
    }
    return (_jsxs("div", { style: { padding: '24px', fontFamily: 'system-ui' }, children: [
        _jsx("h1", { children: "Space Crew Lobby" }),
        _jsxs("p", { children: ["Room Code: ", _jsx("strong", { children: room.code })] }),
        _jsx("h2", { children: "Seats" }),
        _jsx("div", { style: { marginBottom: '24px' }, children: room.seats.length === 0 ? (_jsx("p", { children: "No seats yet." })) : (room.seats.map((seat) => (_jsxs("div", { style: { padding: '8px', border: '1px solid #ddd', marginBottom: '8px' }, children: [
            _jsx("strong", { children: seat.player }),
            " ",
            seat.isBot ? '(Bot)' : '(Human)',
            " — ",
            seat.connected ? 'Connected' : 'Disconnected'
        ] }, seat.player)))) }),
        _jsx("div", { style: { marginTop: '24px' }, children: room.started ? (_jsx("p", { style: { color: '#2b7', fontWeight: 'bold' }, children: "Game has started!" })) : (_jsx("button", { onClick: onStart, style: { padding: '8px 16px', fontSize: '16px', cursor: 'pointer' }, children: "시작" })) })
    ] }));
}
