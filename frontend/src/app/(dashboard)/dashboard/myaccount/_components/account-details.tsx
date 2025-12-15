import { UserAccount } from "@/lib/schema";

interface AccountDetailsProps {
  accountData: UserAccount;
  onEdit: () => void;
}


const AccountDetails = ({ accountData, onEdit }: AccountDetailsProps) => {
  return (
    <div className="p-4">
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-500">Account Number</h3>
        <p className="text-lg font-mono">{accountData.accountNumber}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <h3 className="text-sm font-medium text-gray-500">First Name</h3>
          <p className="text-lg">{accountData.firstName}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500">Last Name</h3>
          <p className="text-lg">{accountData.lastName}</p>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-500">Email</h3>
        <p className="text-lg">{accountData.email}</p>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-500">Phone Number</h3>
        <p className="text-lg">{accountData.phoneNumber}</p>
      </div>

      {accountData.address && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-500">Address</h3>
          <p className="text-lg">{accountData.address}</p>
        </div>
      )}

      {accountData.energyPreference && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-500">Electricity Preference</h3>
          <p className="text-lg capitalize">
            {accountData.energyPreference.toLowerCase()}
          </p>
        </div>
      )}

      {accountData.paymentMethod && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-500">Payment Method</h3>
          <p className="text-lg">
            {accountData.paymentMethod === 'CREDIT_CARD' && 'Credit Card'}
            {accountData.paymentMethod === 'MOBILE_MONEY' && 'Mobile Money'}
            {accountData.paymentMethod === 'BANK_TRANSFER' && 'Bank Transfer'}
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onEdit}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Edit Information
        </button>
      </div>
    </div>
  );
};

export default AccountDetails;