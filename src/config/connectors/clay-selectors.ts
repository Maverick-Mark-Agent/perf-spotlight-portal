export const claySelectors = {
  login: {
    emailInput: "input[name=\"email\"]",
    passwordInput: "input[name=\"password\"]",
    loginButton: "button[type=\"submit\"]",
    successIndicator: ".workspace-nav, .folder-tree"
  },
  navigation: {
    folderLinkTemplate: "a:has-text(\"{name}\")",
    newButton: "button:has-text(\"New\")",
    newFolderOption: "[role=\"menuitem\"]:has-text(\"Folder\")",
    newWorkbookOption: "[role=\"menuitem\"]:has-text(\"Workbook\")"
  },
  import: {
    addButton: "button:has-text(\"Add\")",
    importCSVOption: "[role=\"menuitem\"]:has-text(\"Import from CSV\")",
    fileInput: "input[type=\"file\"]",
    delimiterSelect: "select[name=\"delimiter\"]",
    addToCurrentTable: "input[value=\"add\"]",
    continueButton: "button:has-text(\"Continue\")",
    saveAndRunButton: "button:has-text(\"Save and run rows\")"
  },
  formulas: {
    columnHeaderTemplate: "th:has-text(\"{name}\")",
    insertColumnRight: "button:has-text(\"Insert 1 column right\")",
    formulaOption: "[role=\"menuitem\"]:has-text(\"Formula\")",
    formulaDescriptionInput: "textarea[placeholder*=\"Describe\"]",
    generateFormulaButton: "button:has-text(\"Generate Formula\")",
    saveButton: "button:has-text(\"Save\")"
  },
  enrichment: {
    addEnrichmentButton: "button:has-text(\"Add enrichment\")",
    searchEnrichment: "input[placeholder*=\"Search\"]",
    debounceOption: "[role=\"option\"]:has-text(\"Debounce\")",
    validateEmailOption: "[role=\"option\"]:has-text(\"Validate Email\")",
    columnMappingInput: "input[placeholder*=\"column\"]",
    firstSafeToSendToggle: "input[name=\"first_safe_to_send_email\"]"
  },
  filters: {
    filtersButton: "button:has-text(\"Filters\")",
    addFilterButton: "button:has-text(\"Add filter\")",
    filterColumn: "select[name=\"filter_column\"]",
    filterOperator: "select[name=\"filter_operator\"]",
    filterValue: "input[name=\"filter_value\"]"
  },
  export: {
    actionsButton: "button:has-text(\"Actions\")",
    exportOption: "[role=\"menuitem\"]:has-text(\"Export\")",
    downloadCSVButton: "button:has-text(\"Download CSV\")"
  }
};

// Helper functions for dynamic selectors
export const clayDynamicSelectors = {
  folderLink: (name: string) => claySelectors.navigation.folderLinkTemplate.replace('{name}', name),
  columnHeader: (name: string) => claySelectors.formulas.columnHeaderTemplate.replace('{name}', name)
};