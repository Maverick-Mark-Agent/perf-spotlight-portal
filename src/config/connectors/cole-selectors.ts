export const coleSelectors = {
  login: {
    usernameInput: "#username",
    passwordInput: "#password",
    submitButton: "button[type=\"submit\"]",
    successIndicator: ".dashboard, .search-form"
  },
  query: {
    stateDropdown: "#state-select",
    listTypeRadio: "input[value=\"emailing\"]",
    zipInput: "#zip-codes",
    fieldCheckboxes: ".field-selector input[type=\"checkbox\"]"
  },
  results: {
    resultCount: ".result-count",
    selectAllCheckbox: "#select-all",
    downloadButton: ".download-csv",
    exportFormatRadio: "input[value=\"csv\"]"
  }
};