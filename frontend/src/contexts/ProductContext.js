import {createContext,useContext} from 'react';
export const ProductContext = createContext();

export const useProduct = () => useContext(ProductContext);

