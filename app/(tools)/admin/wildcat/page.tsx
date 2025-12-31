"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type TabType = "leads" | "meetings" | "payments" | "contracts" | "clients";

export default function AdminWildcatPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("leads");
  const [leads, setLeads] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin, activeTab]);

  const checkAdminAccess = async () => {
    try {
      const supabase = createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        router.push("/login");
        return;
      }

      if (user.email !== 'mgr@tri-two.com') {
        router.push("/");
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error("Error checking admin access:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      switch (activeTab) {
        case "leads":
          const leadsRes = await fetch('/api/admin/wildcat/leads');
          if (leadsRes.ok) {
            const leadsData = await leadsRes.json();
            setLeads(leadsData.leads || []);
          }
          break;
        case "meetings":
          const meetingsRes = await fetch('/api/admin/wildcat/meetings');
          if (meetingsRes.ok) {
            const meetingsData = await meetingsRes.json();
            setMeetings(meetingsData.meetings || []);
          }
          break;
        case "payments":
          const paymentsRes = await fetch('/api/admin/wildcat/payments');
          if (paymentsRes.ok) {
            const paymentsData = await paymentsRes.json();
            setPayments(paymentsData.payments || []);
          }
          break;
        case "contracts":
          const contractsRes = await fetch('/api/admin/wildcat/contracts');
          if (contractsRes.ok) {
            const contractsData = await contractsRes.json();
            setContracts(contractsData.contracts || []);
          }
          break;
        case "clients":
          const clientsRes = await fetch('/api/admin/wildcat/clients');
          if (clientsRes.ok) {
            const clientsData = await clientsRes.json();
            setClients(clientsData.clients || []);
          }
          break;
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom, #0b0f1a, #05070d)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#2F80FF' }}></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: "leads", label: "Leads" },
    { id: "meetings", label: "Meetings" },
    { id: "payments", label: "Payments" },
    { id: "contracts", label: "Contracts" },
    { id: "clients", label: "Clients" },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "leads":
        return (
          <div className="space-y-4">
            {leads.map((lead) => (
              <div key={lead.id} className="bg-void-black rounded-lg border border-steel-gray p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold">{lead.name || lead.email}</h3>
                    <p className="text-sm text-cool-ash">{lead.companyName}</p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-blue-600 rounded">{lead.status}</span>
                </div>
                <p className="text-xs text-cool-ash">{lead.canonicalUrl}</p>
                <p className="text-xs text-cool-ash mt-2">Source: {lead.source}</p>
              </div>
            ))}
          </div>
        );
      case "meetings":
        return (
          <div className="space-y-4">
            {meetings.map((meeting) => (
              <div key={meeting.id} className="bg-void-black rounded-lg border border-steel-gray p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold">{meeting.email}</h3>
                    <p className="text-sm text-cool-ash">{meeting.meetingType}</p>
                  </div>
                  <span className="text-xs text-cool-ash">{new Date(meeting.scheduledAt).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-cool-ash">Status: {meeting.status}</p>
              </div>
            ))}
          </div>
        );
      case "payments":
        return (
          <div className="space-y-4">
            {payments.map((payment) => (
              <div key={payment.id} className="bg-void-black rounded-lg border border-steel-gray p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold">{payment.email}</h3>
                    <p className="text-sm text-cool-ash">{payment.companyName}</p>
                  </div>
                  <span className="text-sm font-semibold">${(payment.amountCents / 100).toFixed(2)}</span>
                </div>
                <p className="text-xs text-cool-ash">Status: {payment.status}</p>
                <p className="text-xs text-cool-ash">{new Date(payment.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        );
      case "contracts":
        return (
          <div className="space-y-4">
            {contracts.map((contract) => (
              <div key={contract.id} className="bg-void-black rounded-lg border border-steel-gray p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold">{contract.client?.companyName || contract.client?.email}</h3>
                    <p className="text-sm text-cool-ash">{contract.planTier}</p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-green-600 rounded">{contract.status}</span>
                </div>
                <p className="text-xs text-cool-ash">
                  {new Date(contract.startDate).toLocaleDateString()} - {new Date(contract.endDate).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        );
      case "clients":
        return (
          <div className="space-y-4">
            {clients.map((client) => (
              <div key={client.id} className="bg-void-black rounded-lg border border-steel-gray p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold">{client.companyName || client.email}</h3>
                    <p className="text-sm text-cool-ash">{client.planTier}</p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-blue-600 rounded">{client.status}</span>
                </div>
                <p className="text-xs text-cool-ash">{client.canonicalUrl}</p>
              </div>
            ))}
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen text-white relative overflow-hidden" style={{ background: 'linear-gradient(to bottom, #0b0f1a, #05070d)' }}>
      <div className="relative z-10 p-8">
        <h1 className="text-4xl font-bold mb-8">Wildcat - CRM</h1>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-steel-gray">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-[#2F80FF] text-[#2F80FF]'
                  : 'text-cool-ash hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-obsidian rounded-lg border border-steel-gray p-6">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

