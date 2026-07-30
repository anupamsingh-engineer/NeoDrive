import { combineReducers } from "@reduxjs/toolkit";

import { baseApi } from "./api/baseApi";
import authReducer from "./slices/auth-slice";
import registrationReducer from "./slices/registrationSlice";

const rootReducer = combineReducers({
  [baseApi.reducerPath]: baseApi.reducer,
  auth: authReducer,
  registration: registrationReducer,
});

export default rootReducer;
