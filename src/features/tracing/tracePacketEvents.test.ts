/*
 * Copyright (c) 2026 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import { type StreamPacket } from '@nordicsemi/nrfml-js';

import { packetsToEvent } from './tracePacketEvents';

const timestamp = new Date('2026-10-06T12:22:51.613Z');

const packet = (
    dissector: string,
    data = new Uint8Array([79, 75, 13, 10]),
): StreamPacket => ({
    kind: { type: 'Dissectable', dissector, data },
    timestamp,
    sequenceNumber: BigInt(42),
});

describe('packetsToEvent', () => {
    it('converts a dissectable packet into a TraceEvent', () => {
        const data = new Uint8Array([65, 84]);

        expect(packetsToEvent(packet('at', data))).toEqual({
            format: 'AT',
            networkType: undefined,
            timestamp: 1665058971613,
            data,
            sequenceNumber: 42,
        });
    });

    it('keeps the timestamp as epoch milliseconds', () => {
        // Regression: in nrfml-js 0.7.0 this used to read Date.getMilliseconds(), which returns
        // only the 0-999 sub-second field, and then divided it by 1000.
        expect(packetsToEvent(packet('at')).timestamp).toBe(
            timestamp.getTime(),
        );
    });

    it('labels the dissector', () => {
        const formatOf = (dissector: string) =>
            packetsToEvent(packet(dissector)).format;

        expect(formatOf('at')).toBe('AT');
        expect(formatOf('nas-eps')).toBe('NAS');
        expect(formatOf('ip')).toBe('IP');
        expect(formatOf('lte_rrc.dl_dcch')).toBe('RRC');
        expect(formatOf('something-else')).toBe('');
    });

    it('derives the network type from an lte_rrc dissector', () => {
        const networkTypeOf = (dissector: string) =>
            packetsToEvent(packet(dissector)).networkType;

        expect(networkTypeOf('lte_rrc.bcch_dl_sch.nb')).toBe('NB-IoT');
        expect(networkTypeOf('lte_rrc.bcch_dl_sch.lte')).toBe('LTE-M');
        expect(networkTypeOf('lte_rrc.dl_dcch')).toBeNull();
        expect(networkTypeOf('at')).toBeUndefined();
    });

    it('has no format for a packet that is not dissectable', () => {
        expect(
            packetsToEvent({
                kind: { type: 'Raw', data: new Uint8Array([1, 2]) },
                timestamp,
                sequenceNumber: BigInt(1),
            }).format,
        ).toBe('');
    });
});
