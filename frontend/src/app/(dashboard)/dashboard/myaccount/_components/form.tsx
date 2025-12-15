"use client";

import { updateAccountData, UserAccount } from '@/lib/schema';
import { useState } from 'react';

interface AccountFormProps {
  accountData: UserAccount;
  onCancel: () => void;
  onSave: (data: UserAccount) => void;
}

const AccountForm = ({ accountData, onCancel, onSave }: AccountFormProps) => {
  const [formData, setFormData] = useState<UserAccount>(accountData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      //   const updateData = {
      //   address: formData.address,
      //   energy_preference: formData.energyPreference,
      //   payment_method: formData.paymentMethod,
      // };
      const updatedData = await updateAccountData(formData);
      onSave(updatedData);
    } catch (error) {
      console.error('Failed to update account:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div>
          <label htmlFor="accountNumber" className="block text-sm font-medium mb-1">
            Account Number
          </label>
          <input
            type="text"
            id="accountNumber"
            name="accountNumber"
            value={formData.accountNumber}
            readOnly
            disabled
            className="w-full p-2 border rounded-md bg-gray-100 cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 mt-1">
            Account number cannot be changed as it's your unique identifier.
          </p>
        </div>

        <div>
          <label htmlFor="firstName" className="block text-sm font-medium mb-1">
            First Name
          </label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            className="w-full p-2 border rounded-md"
            required
          />
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium mb-1">
            Last Name
          </label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            className="w-full p-2 border rounded-md"
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className="w-full p-2 border rounded-md"
          required
        />
      </div>

      <div>
        <label htmlFor="phoneNumber" className="block text-sm font-medium mb-1">
          Phone Number
        </label>
        <input
          type="tel"
          id="phoneNumber"
          name="phoneNumber"
          value={formData.phoneNumber}
          onChange={handleChange}
          className="w-full p-2 border rounded-md"
          required
        />
      </div>

      <div>
        <label htmlFor="address" className="block text-sm font-medium mb-1">
          Address
        </label>
        <input
          type="text"
          id="address"
          name="address"
          value={formData.address || ''}
          onChange={handleChange}
          className="w-full p-2 border rounded-md"
        />
      </div>

      <div>
        <label htmlFor="energyPreference" className="block text-sm font-medium mb-1">
          Electricity Preference
        </label>
        <select
          id="energyPreference"
          name="energyPreference"
          value={formData.energyPreference || ''}
          onChange={handleChange}
          className="w-full p-2 border rounded-md"
        >
          <option value="">Select Electricity Preference</option>
          <option value="SOLAR">Solar</option>
          <option value="HYDRO">Hydro</option>
          <option value="THERMAL">Thermal</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      <div>
        <label htmlFor="paymentMethod" className="block text-sm font-medium mb-1">
          Payment Method
        </label>
        <select
          id="paymentMethod"
          name="paymentMethod"
          value={formData.paymentMethod || ''}
          onChange={handleChange}
          className="w-full p-2 border rounded-md"
        >
          <option value="">Select Payment Method</option>
          <option value="CREDIT_CARD">Credit Card</option>
          <option value="MOBILE_MONEY">Mobile Money</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
        </select>
      </div>


      <div className="flex justify-end space-x-2 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border rounded-md hover:bg-gray-100"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
};

export default AccountForm;