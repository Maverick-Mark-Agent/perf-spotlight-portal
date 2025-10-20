export const bisonSelectors = {
  login: {
    emailInput: 'input[name="email"]',
    passwordInput: 'input[name="password"]',
    submitButton: 'button[type="submit"]',
    successIndicator: '.workspace-selector'
  },
  navigation: {
    workspaceLinkTemplate: 'a:has-text("{name}")',
    contactsTab: 'a:has-text("Contacts")',
    campaignsTab: 'a:has-text("Campaigns")'
  },
  contacts: {
    importButton: 'button:has-text("Import new contacts")',
    fileInput: 'input[type="file"]',
    listNameInput: 'input[name="list_name"]',
    importSubmitButton: 'button:has-text("Import")',
    importCompleteIndicator: '.import-complete',
    contactCount: '.contact-count'
  },
  campaigns: {
    searchInput: 'input[placeholder*="Search"]',
    campaignLink: 'a.campaign-title',
    campaignTitle: 'input[name="campaign_title"]',
    actionsButton: 'button:has-text("Actions")',
    renameOption: 'button:has-text("Rename")',
    addContactsOption: 'button:has-text("Add more contacts")',
    saveButton: 'button:has-text("Save")',
    addButton: 'button:has-text("Add")'
  }
};

// Helper functions for dynamic selectors
export const bisonDynamicSelectors = {
  workspaceLink: (workspaceName: string) => bisonSelectors.navigation.workspaceLinkTemplate.replace('{name}', workspaceName),
  listCheckbox: (listName: string) => `input[value="${listName}"]`,
  campaignById: (campaignId: string) => `a[data-campaign-id="${campaignId}"]`
};