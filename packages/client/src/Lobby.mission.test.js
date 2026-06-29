import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen, fireEvent } from '@testing-library/react';
import { Lobby } from './Lobby';
import { describe, test, expect, vi } from 'vitest';
describe('Lobby mission selection', () => {
    test('host picks a mission and creates with it', () => {
        const onCreate = vi.fn();
        render(_jsx(Lobby, { onCreate: onCreate, onStart: () => { } }));
        fireEvent.change(screen.getByTestId('mission-select'), { target: { value: '9' } });
        fireEvent.click(screen.getByText(/방 만들기/));
        expect(onCreate).toHaveBeenCalledWith(9);
    });
});
describe('Lobby join by code', () => {
    test('typing a code and clicking 합류 calls onJoin with the code', () => {
        const onJoin = vi.fn();
        render(_jsx(Lobby, { onCreate: () => { }, onStart: () => { }, onJoin: onJoin }));
        fireEvent.change(screen.getByTestId('join-code-input'), { target: { value: 'XY99' } });
        fireEvent.click(screen.getByText(/합류/));
        expect(onJoin).toHaveBeenCalledWith('XY99');
    });
    test('합류 button is disabled when code input is empty', () => {
        render(_jsx(Lobby, { onCreate: () => { }, onStart: () => { }, onJoin: () => { } }));
        const button = screen.getByText(/합류/).closest('button');
        expect(button).toBeDisabled();
    });
});
