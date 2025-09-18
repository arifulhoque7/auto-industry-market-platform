'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ServiceRequest {
  _id: string;
  carDetails: {
    make: string;
    model: string;
    year: number;
  };
  serviceType: string;
  description: string;
  urgency: string;
  status: string;
  createdAt: string;
  quotes?: any[];
}

export default function OwnerDashboard() {
  const router = useRouter();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [inventory, setInventory] = useState<any[]>([]);
  const [showInventory, setShowInventory] = useState(false);
  const [formData, setFormData] = useState({
    carDetails: {
      make: '',
      model: '',
      year: new Date().getFullYear()
    },
    serviceType: '',
    description: '',
    urgency: 'medium',
    location: {
      city: '',
      state: '',
      zipCode: ''
    }
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }
    fetchRequests();
    fetchInventory();

    // Connect to WebSocket for real-time updates
    import('../../../lib/socket').then(({ default: socketService }) => {
      const socket = socketService.connect(token);

      socketService.subscribeToQuoteUpdates((data: any) => {
        console.log('New quote received:', data);
        fetchRequests(); // Refresh requests to show new quote
      });

      socketService.subscribeToInventoryUpdates((data: any) => {
        console.log('Inventory update:', data);
        fetchInventory(); // Refresh inventory
      });

      return () => {
        socketService.disconnect();
      };
    });
  }, []);

  const fetchInventory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/parts', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Fetched inventory data:', data); // Debug log
        // The API returns { parts: [], pagination: {} }
        if (data.parts && Array.isArray(data.parts)) {
          setInventory(data.parts);
        } else if (Array.isArray(data)) {
          setInventory(data);
        } else {
          console.warn('Unexpected inventory data format:', data);
          setInventory([]);
        }
      } else {
        console.error('Failed to fetch inventory, status:', response.status);
        setInventory([]);
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
      setInventory([]);
    }
  };

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No token found');
        router.push('/auth/login');
        return;
      }

      const response = await fetch('http://localhost:3001/api/requests', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Handle paginated response or direct array
        setRequests(data.requests || (Array.isArray(data) ? data : []));
      } else if (response.status === 403 || response.status === 401) {
        // Token expired or invalid
        localStorage.clear();
        router.push('/auth/login');
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error);
      setRequests([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setShowNewRequest(false);
        setFormData({
          carDetails: {
            make: '',
            model: '',
            year: new Date().getFullYear()
          },
          serviceType: '',
          description: '',
          urgency: 'medium',
          location: {
            city: '',
            state: '',
            zipCode: ''
          }
        });
        fetchRequests();
      }
    } catch (error) {
      console.error('Failed to create request:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Car Owner Dashboard</h1>
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
          <div className="flex gap-4">
            <button
              onClick={() => setShowNewRequest(!showNewRequest)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              New Service Request
            </button>
            <button
              onClick={() => setShowInventory(!showInventory)}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              {showInventory ? 'Hide' : 'View'} Spare Parts
            </button>
          </div>
        </div>

        {showNewRequest && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-semibold mb-4">Create Service Request</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Make</label>
                  <input
                    type="text"
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    value={formData.carDetails.make}
                    onChange={(e) => setFormData({...formData, carDetails: {...formData.carDetails, make: e.target.value}})}
                    placeholder="Toyota"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Model</label>
                  <input
                    type="text"
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    value={formData.carDetails.model}
                    onChange={(e) => setFormData({...formData, carDetails: {...formData.carDetails, model: e.target.value}})}
                    placeholder="Camry"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Year</label>
                  <input
                    type="number"
                    required
                    min="1900"
                    max={new Date().getFullYear() + 1}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    value={formData.carDetails.year}
                    onChange={(e) => setFormData({...formData, carDetails: {...formData.carDetails, year: parseInt(e.target.value)}})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Service Type</label>
                <select
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={formData.serviceType}
                  onChange={(e) => setFormData({...formData, serviceType: e.target.value})}
                >
                  <option value="">Select service type</option>
                  <option value="maintenance">Regular Maintenance</option>
                  <option value="repair">Repair</option>
                  <option value="inspection">Inspection</option>
                  <option value="bodywork">Body Work</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  required
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Describe the issue or service needed..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Urgency</label>
                <select
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={formData.urgency}
                  onChange={(e) => setFormData({...formData, urgency: e.target.value})}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">City</label>
                  <input
                    type="text"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    value={formData.location.city}
                    onChange={(e) => setFormData({...formData, location: {...formData.location, city: e.target.value}})}
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">State</label>
                  <input
                    type="text"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    value={formData.location.state}
                    onChange={(e) => setFormData({...formData, location: {...formData.location, state: e.target.value}})}
                    placeholder="State"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Zip Code</label>
                  <input
                    type="text"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    value={formData.location.zipCode}
                    onChange={(e) => setFormData({...formData, location: {...formData.location, zipCode: e.target.value}})}
                    placeholder="Zip Code"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Submit Request
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewRequest(false)}
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
            <h2 className="text-xl font-semibold">Your Service Requests</h2>
          </div>
          <div className="p-6">
            {!requests || requests.length === 0 ? (
              <p className="text-gray-500">No service requests yet.</p>
            ) : (
              <div className="space-y-4">
                {requests && Array.isArray(requests) && requests.map((request) => (
                  <div key={request._id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold">{request.carDetails.year} {request.carDetails.make} {request.carDetails.model}</h3>
                        <p className="text-sm text-gray-600">{request.serviceType}</p>
                        <p className="mt-2">{request.description}</p>

                        {request.quotes && request.quotes.length > 0 && (
                          <div className="mt-4">
                            <h4 className="font-semibold text-sm mb-2">Quotes Received ({request.quotes.length})</h4>
                            <div className="space-y-2">
                              {request.quotes.map((quote: any) => (
                                <div key={quote.quoteId} className="bg-gray-50 p-3 rounded">
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <p className="font-medium">{quote.shopName}</p>
                                      <p className="text-sm text-gray-600">
                                        ${quote.totalCost} - {quote.estimatedHours} hours
                                      </p>
                                    </div>
                                    {request.status !== 'accepted' && (
                                      <button
                                        onClick={async () => {
                                          const token = localStorage.getItem('token');
                                          const response = await fetch(`http://localhost:3001/api/requests/${request._id}/accept-quote`, {
                                            method: 'POST',
                                            headers: {
                                              'Content-Type': 'application/json',
                                              'Authorization': `Bearer ${token}`
                                            },
                                            body: JSON.stringify({ quoteId: quote.quoteId })
                                          });
                                          if (response.ok) {
                                            alert('Quote accepted!');
                                            fetchRequests();
                                          }
                                        }}
                                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                                      >
                                        Accept
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <span className={`px-2 py-1 text-xs rounded ml-4 ${
                        request.status === 'open' ? 'bg-green-100 text-green-800' :
                        request.status === 'quoted' ? 'bg-blue-100 text-blue-800' :
                        request.status === 'accepted' ? 'bg-purple-100 text-purple-800' :
                        request.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {request.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {showInventory && (
          <div className="bg-white rounded-lg shadow mt-6">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Available Spare Parts</h2>
            </div>
            <div className="p-6">
              {!inventory || inventory.length === 0 ? (
                <p className="text-gray-500">No parts available.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inventory.map((part: any) => (
                    <div key={part.id} className="border rounded-lg p-4">
                      <h3 className="font-semibold">{part.name}</h3>
                      <p className="text-sm text-gray-600">
                        {part.category} {part.brand ? `- ${part.brand}` : ''}
                      </p>
                      <p className="mt-2 text-lg font-bold">${part.price}</p>
                      <p className="text-sm">
                        Stock: <span className={`font-medium ${part.stock > 10 ? 'text-green-600' : part.stock > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {part.stock} units
                        </span>
                      </p>
                      {part.compatible_cars && part.compatible_cars.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          Compatible: {part.compatible_cars.join(', ')}
                        </p>
                      )}
                      {part.description && (
                        <p className="text-xs text-gray-600 mt-2">{part.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}