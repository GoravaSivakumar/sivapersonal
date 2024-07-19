import { LightningElement, track, wire } from 'lwc';
import getProducts from '@salesforce/apex/OpportunityProductsAccountsController.getProducts';
import getAccounts from '@salesforce/apex/OpportunityProductsAccountsController.getAccounts';
import saveProductAccounts from '@salesforce/apex/OpportunityProductsAccountsController.saveProductAccounts';
import deleteProductAccount from '@salesforce/apex/OpportunityProductsAccountsController.deleteProductAccount';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class OpportunityProductsAccountsController extends LightningElement {
    @track products = [];
    @track accounts = [];
    @track productAccounts = [];
    @track isAccountModalOpen = false;
    @track isConfirmationModalOpen = false;
    @track accountIdToDelete = null;
    @track filteredAccounts = [];
    @track selectedAccountIds = [];
    @track searchKey = '';
    selectedProductId = null;

    accountColumns = [
        { label: 'Account Name', fieldName: 'Name' }
        // Add more fields as needed
    ];

    @wire(getProducts)
    wiredProducts({ error, data }) {
        if (data) {
            this.products = data;
            this.initializeProductAccounts();
        } else if (error) {
            console.error(error);
        }
    }

    @wire(getAccounts)
    wiredAccounts({ error, data }) {
        if (data) {
            this.accounts = data;
            this.filteredAccounts = data;
        } else if (error) {
            console.error(error);
        }
    }

    initializeProductAccounts() {
        this.productAccounts = this.products.map(product => ({
            product,
            accounts: []
        }));
    }

    handleAddAccountClick(event) {
        this.selectedProductId = event.currentTarget.dataset.productId;
        this.isAccountModalOpen = true;
        this.filterAccounts();
    }

    handleCloseModal() {
        this.isAccountModalOpen = false;
        this.selectedAccountIds = [];
        this.searchKey = '';
        this.filterAccounts();
    }

    handleAccountSelection(event) {
        this.selectedAccountIds = event.detail.selectedRows.map(row => row.Id);
    }

    handleAddAccounts() {
        const selectedAccounts = this.accounts.filter(account => this.selectedAccountIds.includes(account.Id));
        this.productAccounts = this.productAccounts.map(item => {
            if (item.product.Id === this.selectedProductId) {
                item.accounts = [...item.accounts, ...selectedAccounts];
            }
            return item;
        });

        // Save to custom object
        const productAccountsMap = {};
        productAccountsMap[this.selectedProductId] = this.selectedAccountIds;
        
        saveProductAccounts({ productAccounts: productAccountsMap })
            .then(() => {
                this.isAccountModalOpen = false;
                this.selectedAccountIds = [];
                this.searchKey = '';
                this.filterAccounts();
                this.showToast('Success', 'record created in Opportunity Products and Accounts', 'success');
            })
            .catch(error => {
                console.error(error);
                this.showToast('Error', 'Failed in creating record', 'error');
            });
    }

    handleRemoveAccount(event) {
        const productId = event.target.dataset.productId;
        const accountId = event.target.dataset.accountId;
        this.accountIdToDelete = accountId;
        this.selectedProductId = productId; // Ensure the correct product ID is set
        this.isConfirmationModalOpen = true;
    }

    handleCancelDelete() {
        this.isConfirmationModalOpen = false;
        this.accountIdToDelete = null;
    }

    handleConfirmDelete() {
        if (this.accountIdToDelete) {
            this.productAccounts = this.productAccounts.map(item => {
                if (item.product.Id === this.selectedProductId) {
                    item.accounts = item.accounts.filter(account => account.Id !== this.accountIdToDelete);
                }
                return item;
            });

            // Call Apex method to delete from custom object
            deleteProductAccount({ productId: this.selectedProductId, accountId: this.accountIdToDelete })
                .then(() => {
                    this.showToast('Success', 'Account deleted successfully', 'success');
                })
                .catch(error => {
                    console.error(error);
                    this.showToast('Error', 'Failed to delete account', 'error');
                });

            this.filterAccounts();
        }
        this.isConfirmationModalOpen = false;
        this.accountIdToDelete = null;
    }

    handleSearchAccounts(event) {
        this.searchKey = event.target.value.toLowerCase();
        this.filterAccounts();
    }

    filterAccounts() {
        let filteredData = this.accounts;
        if (this.searchKey) {
            filteredData = filteredData.filter(account =>
                account.Name.toLowerCase().includes(this.searchKey)
            );
        }
        const selectedAccountIds = this.productAccounts.reduce((ids, item) => {
            if (item.product.Id === this.selectedProductId) {
                return ids.concat(item.accounts.map(account => account.Id));
            }
            return ids;
        }, []);
        this.filteredAccounts = filteredData.filter(account => !selectedAccountIds.includes(account.Id));
    }

    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
        });
        this.dispatchEvent(event);
    }
}
