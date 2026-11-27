/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

// import { TraceTaskBuilder } from '@nordicsemi/nrfml-js';
import { testUtils } from '@nordicsemiconductor/pc-nrfconnect-shared/test';
import path from 'path';

import appReducer from '../../app/appReducer';
import { getMockStore, mockedDataDir } from '../../common/testUtils';
import { resetDashboardState } from '../tracingEvents/dashboardSlice';
import { convertTraceFile, startTrace } from './nrfml';
import sinkConfig from './sinkConfig';
import {
    setDetectingTraceDb,
    setTraceDataReceived,
    setTraceIsStarted,
    setTraceIsStopped,
    setTraceSourceFilePath,
} from './traceSlice';

const MOCKED_DEFAULT_WIRESHARK_PATH = 'default/path/to/wireshark';

jest.mock('@nordicsemi/nrfml-js');
jest.mock('../wireshark/wireshark', () => ({
    defaultSharkPath: () => MOCKED_DEFAULT_WIRESHARK_PATH,
}));

jest.mock('@nordicsemiconductor/pc-nrfconnect-shared', () => ({
    ...jest.requireActual('@nordicsemiconductor/pc-nrfconnect-shared'),
    getAppDataDir: () => mockedDataDir,
    getAppFile: () => mockedDataDir,
    selectedDevice: () => {},
}));

const mockStore = getMockStore();

const initialState = {
    app: {
        trace: {
            traceSerialPort: 'COM3',
            traceData: [],
        },
        wireshark: {},
        serialPort: {
            terminalSerialPort: null,
            shellParser: null,
        },
    },
    device: {
        devices: {},
    },
};

const store = mockStore(initialState);

describe('nrfml', () => {
    beforeEach(() => {
        store.clearActions();
    });

    it('should start converting', async () => {
        await store.dispatch(convertTraceFile('somePath.mtrace'));
        expect(store.getActions()).toEqual([
            { payload: true, type: 'trace/setDetectingTraceDb' },
            {
                payload: {
                    progressConfigs: [],
                    taskAbortHandle: {
                        cancel: expect.any(Function),
                    },
                },
                type: 'trace/setTraceIsStarted',
            },
            { type: setDetectingTraceDb.type, payload: false },
            { type: setTraceIsStopped.type, payload: undefined },
            { type: setDetectingTraceDb.type, payload: false },
        ]);
    });

    // label: generated; todo: analyze and uncomment
    // Regression test: a successful conversion used to clear the tracing state
    // only in the .catch() branch, which left `taskAbortHandle` set for the
    // rest of the session. `getIsTracing` then stayed true and disabled UI
    // such as the modem trace database dropdown.
    // it('clears the tracing state after a successful conversion', async () => {
    //     await store.dispatch(convertTraceFile('somePath.mtrace'));
    //
    //     const types = store.getActions().map(action => action.type);
    //
    //     expect(types).toContain(setTraceIsStarted.type);
    //     expect(types).toContain(setTraceIsStopped.type);
    //     expect(types.lastIndexOf(setTraceIsStopped.type)).toBeGreaterThan(
    //         types.indexOf(setTraceIsStarted.type),
    //     );
    // });

    // label: generated
    // describe('which sinks a file is read with', () => {
    //     afterEach(() => {
    //         jest.restoreAllMocks();
    //     });
    //
    //     // Regression test: "Load trace file..." used to request the 'live'
    //     // sink, which is the Wireshark sink, so it launched Wireshark as well
    //     // as filling the in-app dashboard. The dashboard is fed by the
    //     // user-data callback and needs no sink at all.
    //     it('does not attach the Wireshark sink when reading a file into the app', async () => {
    //         const wiresharkSink = jest.spyOn(
    //             TraceTaskBuilder.prototype,
    //             'withWiresharkSink',
    //         );
    //
    //         await store.dispatch(readRawTrace('somePath.mtrace', () => {}));
    //
    //         expect(wiresharkSink).not.toHaveBeenCalled();
    //     });
    //
    //     it('attaches the Wireshark sink when opening a file in Wireshark', async () => {
    //         const wiresharkSink = jest.spyOn(
    //             TraceTaskBuilder.prototype,
    //             'withWiresharkSink',
    //         );
    //
    //         await store.dispatch(convertTraceFile('somePath.mtrace'));
    //
    //         expect(wiresharkSink).toHaveBeenCalled();
    //     });
    // });

    describe('tracing', () => {
        beforeEach(() => {
            jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(
                '2000-01-01T00:00:00.000Z',
            );
        });

        it('should start tracing to pcap', async () => {
            await store.dispatch(startTrace(['pcap']));
            expect(store.getActions()).toEqual([
                { type: resetDashboardState.type, payload: undefined },
                { type: setTraceSourceFilePath.type, payload: null },
                { type: setDetectingTraceDb.type, payload: true },
                { type: setTraceDataReceived.type, payload: false },
                {
                    type: setTraceIsStarted.type,
                    payload: {
                        taskAbortHandle: {
                            cancel: expect.any(Function),
                        },
                        progressConfigs: [
                            {
                                format: 'pcap',
                                path: path.join(
                                    mockedDataDir,
                                    'trace-2000-01-01T00-00-00.000Z.pcapng',
                                ),
                            },
                        ],
                    },
                },
                { type: setDetectingTraceDb.type, payload: false },
                { type: setTraceIsStopped.type, payload: undefined },
            ]);
        });

        it('should start tracing to raw binary', async () => {
            await store.dispatch(startTrace(['raw']));
            expect(store.getActions()).toEqual([
                { type: resetDashboardState.type, payload: undefined },
                { type: setTraceSourceFilePath.type, payload: null },
                { type: setDetectingTraceDb.type, payload: true },
                { type: setTraceDataReceived.type, payload: false },
                {
                    type: setTraceIsStarted.type,
                    payload: {
                        taskAbortHandle: {
                            cancel: expect.any(Function),
                        },
                        progressConfigs: [
                            {
                                format: 'raw',
                                path: path.join(
                                    mockedDataDir,
                                    'trace-2000-01-01T00-00-00.000Z.mtrace',
                                ),
                            },
                        ],
                    },
                },
                { type: setDetectingTraceDb.type, payload: false },
                { type: setTraceIsStopped.type, payload: undefined },
            ]);
        });

        it('does not create a progress config for the live sink alongside raw', async () => {
            await store.dispatch(startTrace(['raw', 'live']));
            expect(store.getActions()).toEqual([
                { type: resetDashboardState.type, payload: undefined },
                { type: setTraceSourceFilePath.type, payload: null },
                { type: setDetectingTraceDb.type, payload: true },
                { type: setTraceDataReceived.type, payload: false },
                {
                    type: setTraceIsStarted.type,
                    payload: {
                        taskAbortHandle: {
                            cancel: expect.any(Function),
                        },
                        progressConfigs: [
                            {
                                format: 'raw',
                                path: path.join(
                                    mockedDataDir,
                                    'trace-2000-01-01T00-00-00.000Z.mtrace',
                                ),
                            },
                        ],
                    },
                },
                { type: setDetectingTraceDb.type, payload: false },
                { type: setTraceIsStopped.type, payload: undefined },
            ]);
        });

        it('does not create a progress config for a live-only trace', async () => {
            await store.dispatch(startTrace(['live']));

            expect(store.getActions()).toEqual([
                { type: resetDashboardState.type, payload: undefined },
                { type: setTraceSourceFilePath.type, payload: null },
                { type: setDetectingTraceDb.type, payload: true },
                { type: setTraceDataReceived.type, payload: false },
                {
                    type: setTraceIsStarted.type,
                    payload: {
                        taskAbortHandle: {
                            cancel: expect.any(Function),
                        },
                        progressConfigs: [],
                    },
                },
                // Since the mock trace returns immediately, we also have to check for this
                { type: setDetectingTraceDb.type, payload: false },
                { type: setTraceIsStopped.type, payload: undefined },
            ]);
        });
    });

    describe('sink configuration', () => {
        const state = testUtils.rootReducer(appReducer)(undefined, {
            type: '@INIT',
        });

        beforeAll(() => {
            Object.defineProperty(process, 'platform', { value: 'MockOS' });
        });

        it('should return proper configuration for raw trace', () => {
            const rawConfig = sinkConfig(
                state,
                { type: 'file', path: 'some/path.mtrace' },
                'raw',
            );
            expect(rawConfig).toEqual({
                file_path: path.join('some', 'path.mtrace'),
            });
        });

        it('should return proper configuration for live trace', () => {
            const liveConfig = sinkConfig(
                state,
                { type: 'file', path: 'some/path.mtrace' },
                'live',
            );
            expect(liveConfig).toEqual({
                application_name: 'Cellular Monitor',
                hw_name: undefined,
                os_name: 'MockOS',
                start_process: MOCKED_DEFAULT_WIRESHARK_PATH,
            });
        });

        it('should return proper configuration for pcap trace', () => {
            const pcapConfig = sinkConfig(
                state,
                { type: 'file', path: 'some/path.mtrace' },
                'pcap',
            );
            expect(pcapConfig).toEqual({
                application_name: 'Cellular Monitor',
                hw_name: undefined,
                os_name: 'MockOS',
                file_path: path.join('some', 'path.pcapng'),
            });
        });
    });
});
