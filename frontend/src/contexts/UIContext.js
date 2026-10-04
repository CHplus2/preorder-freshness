import {createContext,useContext} from 'react';
export const UIContext = createContext();
export const useUI = () => useContext(UIContext);

