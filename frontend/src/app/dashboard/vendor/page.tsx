'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Part {
  id: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  stock: number;
  sku: string;
  compatible_cars: string[];
  description: string;
}

export default function VendorDashboard() {
  const router = useRouter();
  const [parts, setParts] = useState<Part[]>([]);
  const [showAddPart, setShowAddPart] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    brand: '',
    price: '',
    stock: '',
    sku: '',
    compatibleCars: '',
    description: ''
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }
    fetchParts();
  }, []);

  const fetchParts = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No token found');
        router.push('/auth/login');
        return;
      }

      const response = await fetch('http://localhost:3001/api/parts', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setParts(data.parts || (Array.isArray(data) ? data : []));
      } else if (response.status === 403 || response.status === 401) {
        localStorage.clear();
        router.push('/auth/login');
      }
    } catch (error) {
      console.error('Failed to fetch parts:', error);
      setParts([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const submitData = {
        ...formData,
        compatibleCars: formData.compatibleCars ? formData.compatibleCars.split(',').map(s => s.trim()) : []
      };
      const response = await fetch('http://localhost:3001/api/parts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(submitData)
      });

      if (response.ok) {
        setShowAddPart(false);
        setFormData({
          name: '',
          category: '',
          brand: '',
          price: '',
          stock: '',
          sku: '',
          compatibleCars: '',
          description: ''
        });
        fetchParts();
      }
    } catch (error) {
      console.error('Failed to add part:', error);
    }
  };

  const updateStock = async (partId: string, newStock: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/parts/${partId}/stock`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ stock: newStock, operation: 'set' })
      });

      if (response.ok) {
        fetchParts();
      }
    } catch (error) {
      console.error('Failed to update stock:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Vendor Dashboard</h1>
          <button
            onClick={() => {
              localStorage.clear();
              router.push('/auth/login');
            }}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Logout
          </button>
        </div>

        <div className="mb-6">
          <button
            onClick={() => setShowAddPart(!showAddPart)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add New Part
          </button>
        </div>

        {showAddPart && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-semibold mb-4">Add New Part</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Part Name</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <select
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                >
                  <option value="">Select category</option>
                  <option value="engine">Engine</option>
                  <option value="transmission">Transmission</option>
                  <option value="brakes">Brakes</option>
                  <option value="suspension">Suspension</option>
                  <option value="electrical">Electrical</option>
                  <option value="body">Body</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Brand</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  value={formData.brand}
                  onChange={(e) => setFormData({...formData, brand: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Stock</label>
                <input
                  type="number"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  value={formData.stock}
                  onChange={(e) => setFormData({...formData, stock: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">SKU</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  value={formData.sku}
                  onChange={(e) => setFormData({...formData, sku: e.target.value})}
                  placeholder="e.g., BRK-001"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Compatible Cars (comma-separated)</label>
                <input
                  type="text"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  value={formData.compatibleCars}
                  onChange={(e) => setFormData({...formData, compatibleCars: e.target.value})}
                  placeholder="e.g., Toyota Camry 2020, Honda Civic 2019-2021"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={2}
                  placeholder="Detailed description of the part..."
                />
              </div>
              <div className="col-span-2 flex gap-4">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Add Part
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddPart(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold">Inventory</h2>
          </div>
          <div className="p-6">
            {parts.length === 0 ? (
              <p className="text-gray-500">No parts in inventory.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Part Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Brand
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stock
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {parts.map((part: any) => (
                      <tr key={part.id}>
                        <td className="px-6 py-4 whitespace-nowrap">{part.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{part.category}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{part.brand}</td>
                        <td className="px-6 py-4 whitespace-nowrap">${part.price}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded ${
                            part.stock > 10 ? 'bg-green-100 text-green-800' :
                            part.stock > 0 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {part.stock}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => {
                              const newStock = prompt('Enter new stock quantity:', part.stock);
                              if (newStock) updateStock(part.id, parseInt(newStock));
                            }}
                            className="text-blue-600 hover:underline"
                          >
                            Update Stock
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}