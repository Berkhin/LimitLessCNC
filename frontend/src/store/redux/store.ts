/**
 * Redux store for Implementation 2: RTK + redux-saga.
 *
 * Thunks are disabled because every side effect runs through sagas. Importing
 * this module starts the root saga (which opens the WebSocket channel), so it is
 * only imported by the impl2 entry point — never in 'query' mode.
 */

import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import { flowReducer } from './flowSlice';
import { rootSaga } from './sagas/rootSaga';

const sagaMiddleware = createSagaMiddleware();

export const store = configureStore({
  reducer: { flow: flowReducer },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ thunk: false }).concat(sagaMiddleware),
});

sagaMiddleware.run(rootSaga);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
