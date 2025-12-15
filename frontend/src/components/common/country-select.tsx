"use client"

import React, { useEffect } from "react";
import Select from "react-select";



const CountrySelect = ({countries, setCountries, selectedCountry, setSelectedCountry}: {
    countries: Array<any>,
    setCountries: (data: any) => void,
    selectedCountry: any,
    setSelectedCountry: (data: any) => void

}) => {
   
  
    useEffect(() => {
      fetch(
        "https://valid.layercode.workers.dev/list/countries?format=select&flags=true&value=code"
      )
        .then((response) => response.json())
        .then((data) => {
          setCountries(data.countries);
          setSelectedCountry(data.userSelectValue);
        }).catch((error) => {
          console.log("Fetching countries error ")
        });
    }, [setSelectedCountry, setCountries]);
    return (
      <Select
        options={countries}
        value={selectedCountry}
        onChange={(selectedOption) => setSelectedCountry(selectedOption!)}
        classNames={{
          control: (state) => {
            return state.isFocused ? '!bg-gray-100 !dark:bg-gray-900 !border-indigo-600 !border-4 h-14 dark:text-gray-900' : 'border-grey-300 h-14 !dark:bg-gray-700';
          },
          option: (state) => {
            return '!text-gray-900 !dark:text-white';
          },
            
        }}
      />
    );
  };

  export default CountrySelect;