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
}

export default function ShopDashboard() {
  const router = useRouter();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [quoteForm, setQuoteForm] = useState({
    laborCost: '',
    partsCost: '',
    estimatedHours: '',
    description: ''
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }
    fetchRequests();
  }, []);

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
        const requestsArray = data.requests || (Array.isArray(data) ? data : []);
        if (Array.isArray(requestsArray)) {
          setRequests(requestsArray.filter((r: any) => r.status === 'open'));
        } else {
          setRequests([]);
        }
      } else if (response.status === 403 || response.status === 401) {
        localStorage.clear();
        router.push('/auth/login');
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error);
      setRequests([]);
    }
  };

  const submitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          requestId: selectedRequest._id,
          ...quoteForm
        })
      });

      if (response.ok) {
        alert('Quote submitted successfully!');
        setSelectedRequest(null);
        setQuoteForm({
          laborCost: '',
          partsCost: '',
          estimatedHours: '',
          description: ''
        });
        fetchRequests();
      }
    } catch (error) {
      console.error('Failed to submit quote:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Repair Shop Dashboard</h1>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Open Service Requests</h2>
            </div>
            <div className="p-6">
              {requests.length === 0 ? (
                <p className="text-gray-500">No open requests available.</p>
              ) : (
                <div className="space-y-4">
                  {requests.map((request: any) => (
                    <div
                      key={request._id}
                      className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50"
                      onClick={() => setSelectedRequest(request)}
                    >
                      <h3 className="font-semibold">{request.carDetails.year} {request.carDetails.make} {request.carDetails.model}</h3>
                      <p className="text-sm text-gray-600">{request.serviceType}</p>
                      <p className="mt-2 text-sm">{request.description}</p>
                      <div className="mt-2 flex justify-between items-center">
                        <span className={`px-2 py-1 text-xs rounded ${
                          request.urgency === 'urgent' ? 'bg-red-100 text-red-800' :
                          request.urgency === 'high' ? 'bg-orange-100 text-orange-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {request.urgency}
                        </span>
                        <button className="text-blue-600 text-sm hover:underline">
                          Create Quote →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Create Quote</h2>
            </div>
            <div className="p-6">
              {selectedRequest ? (
                <form onSubmit={submitQuote} className="space-y-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="font-semibold">{selectedRequest.carDetails.year} {selectedRequest.carDetails.make} {selectedRequest.carDetails.model}</p>
                    <p className="text-sm text-gray-600">{selectedRequest.description}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Labor Cost ($)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                      value={quoteForm.laborCost}
                      onChange={(e) => setQuoteForm({...quoteForm, laborCost: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Parts Cost ($)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                      value={quoteForm.partsCost}
                      onChange={(e) => setQuoteForm({...quoteForm, partsCost: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Estimated Hours</label>
                    <input
                      type="number"
                      required
                      min="1"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                      value={quoteForm.estimatedHours}
                      onChange={(e) => setQuoteForm({...quoteForm, estimatedHours: e.target.value})}
                      placeholder="e.g., 8"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <textarea
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                      value={quoteForm.description}
                      onChange={(e) => setQuoteForm({...quoteForm, description: e.target.value})}
                      rows={3}
                      placeholder="Describe the work to be done..."
                    />
                  </div>

                  <div className="flex gap-4">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Submit Quote
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRequest(null)}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <p className="text-gray-500">Select a service request to create a quote.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}