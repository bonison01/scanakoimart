import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase/supabaseClient';
import { ColumnConfig, ExtractedData } from '../types';
import { DataForm } from '../components/DataForm';
import { PrintIcon, EditIcon, TrashIcon } from '../components/Icons';
import { HeaderNavigation } from '../components/HeaderNavigation';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import './jj.css'; // Assuming you have a CSS file for styles

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'six_digit_id', header: 'ID', visible: true },
  { key: 'name', header: 'Name', visible: true },
  { key: 'email', header: 'Email', visible: true },
  { key: 'phone', header: 'Phone', visible: true },
  { key: 'date_added', header: 'Date Added', visible: true },
  { key: 'address', header: 'Address', visible: true },
];

export default function SupabaseContactsPage() {
  const [contacts, setContacts] = useState<ExtractedData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<ExtractedData | null>(null);
  const [columnConfig] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [appState, setAppState] = useState<'VIEWING' | 'EDITING' | 'SETTINGS'>('VIEWING');

  useEffect(() => {
    const fetchContacts = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('date_added', { ascending: false });

      if (error) {
        setError('Failed to fetch contacts from Supabase.');
        console.error(error);
      } else {
        setContacts(data || []);
      }
      setLoading(false);
    };

    fetchContacts();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) return;
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) {
      alert('Error deleting contact: ' + error.message);
    } else {
      setContacts(contacts.filter(c => c.id !== id));
    }
  };

  const handleUpdate = async (updatedData: ExtractedData) => {
    const { id, ...updateFields } = updatedData;

    if ('id' in updateFields) {
      delete updateFields['id'];
    }

    const { error } = await supabase
      .from('contacts')
      .update(updateFields)
      .eq('id', id);

    if (error) {
      alert('Error updating contact: ' + error.message);
    } else {
      setEditingContact(null);
      const updatedList = contacts.map(contact =>
        contact.id === id ? { ...contact, ...updateFields } : contact
      );
      setContacts(updatedList);
    }
  };

  const handlePrint = (contact: ExtractedData) => {
    const printableWindow = window.open('', '_blank');
    if (!printableWindow) return;

    const sixDigitId = contact.six_digit_id?.toString().padStart(6, '0') ?? '';

    const printableHtml = `
      <html>
        <head>
          <title>Print Contact</title>
          <link rel="stylesheet" href="/styles/print.css" />
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              background: white;
              color: black;
            }
            .print-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 30px;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
            }
            .id-block {
              text-align: right;
              font-family: 'OCR A Std', monospace;
            }
            .id-number {
              font-size: 28px;
              letter-spacing: 6px;
              user-select: none;
            }
            .barcode-upc {
              margin-top: 8px;
              display: flex;
              justify-content: flex-end;
              gap: 2px;
            }
            .barcode-bar {
              width: 3px;
              background: black;
            }
            .bar-0 { height: 50px; }
            .bar-1 { height: 90px; }
            .bar-2 { height: 50px; }
            .bar-3 { height: 90px; }
            .bar-4 { height: 50px; }
            .bar-5 { height: 90px; }
            .bar-6 { height: 50px; }
            .bar-7 { height: 90px; }
            .bar-8 { height: 50px; }
            .bar-9 { height: 90px; }

            h2 {
              font-size: 20px;
              margin-bottom: 10px;
            }
            ul {
              list-style: none;
              padding: 0;
            }
            li {
              margin-bottom: 8px;
              font-size: 16px;
            }
            .thank-you {
              margin-top: 40px;
              text-align: center;
              font-size: 14px;
              color: gray;
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <div class="company-name">
              Mateng Delivery<br />
              Sagolband Sayang Leirak, near Indian Oil Pump<br />
              Mobile: +918787649928
            </div>

            <div class="id-block" aria-label="Contact ID and barcode">
              <div class="id-number">${sixDigitId}</div>
              <div class="barcode-upc" aria-hidden="true">
                ${sixDigitId
                  .split('')
                  .map(digit => `<div class="barcode-bar bar-${digit}"></div>`)
                  .join('')}
              </div>
            </div>
          </div>

          <h2>Contact Details</h2>
          <ul>
            ${columnConfig
              .filter(c => c.visible)
              .map(c => `<li><strong>${c.header}:</strong> ${contact[c.key] || ''}</li>`)
              .join('')}
          </ul>

          <div class="thank-you">
            <p>Thank you for using our services!</p>
            <p>Justmateng Service Pvt. ltd</p>
          </div>

          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `;

    printableWindow.document.write(printableHtml);
    printableWindow.document.close();
  };

  const handleExportPDF = async () => {
  try {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Container to render individual contact temporarily
    const container = document.createElement('div');
    container.style.position = 'fixed'; // so it doesn't affect layout
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '800px'; // same width as your hidden container
    container.style.padding = '20px';
    container.style.background = 'white';
    container.style.color = 'black';
    container.style.zIndex = '-1'; // behind everything
    document.body.appendChild(container);

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];

      // Clear container
      container.innerHTML = '';

      // Build header
      const header = document.createElement('div');
      header.style.marginBottom = '20px';
      header.innerHTML = `
        <h1 style="margin:0; font-size:24px;">Mateng Delivery</h1>
        <p style="margin:0;">Sagolband Sayang Leirak, near Indian Oil Pump</p>
        <p style="margin:0;">Mobile: +918787649928</p>
        <hr style="margin-top: 10px; margin-bottom: 20px;" />
      `;
      container.appendChild(header);

      // Build contact content
      const content = document.createElement('div');
      content.style.fontSize = '14px';
      content.style.lineHeight = '1.5';

      columnConfig
        .filter(c => c.visible)
        .forEach(c => {
          const row = document.createElement('div');
          row.innerHTML = `<strong>${c.header}:</strong> ${contact[c.key] || ''}`;
          content.appendChild(row);
        });

      container.appendChild(content);

      // Build footer
      const footer = document.createElement('div');
      footer.style.marginTop = '30px';
      footer.style.fontSize = '12px';
      footer.style.color = 'gray';
      footer.style.textAlign = 'center';
      footer.innerHTML = `
        <hr style="margin-bottom: 10px;" />
        <p>Thank you for using our services!</p>
        <p>Justmateng Service Pvt. ltd</p>
      `;
      container.appendChild(footer);

      // Wait a tick for layout/rendering
      await new Promise(r => setTimeout(r, 100));

      // Render to canvas
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');

      const imgProps = pdf.getImageProperties(imgData);
      const pdfHeight = (imgProps.height * pageWidth) / imgProps.width;

      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pdfHeight);
    }

    document.body.removeChild(container);

    pdf.save('contacts.pdf');
  } catch (error) {
    console.error('PDF export failed:', error);
    alert('Failed to export PDF. See console for details.');
  }
};



  const onNavigate = (page: 'VIEWING' | 'EDITING' | 'SETTINGS') => {
    setAppState(page);
    setIsSettingsOpen(page === 'SETTINGS');
  };

  if (loading) return <p className="text-center text-lg text-gray-400">Loading contacts...</p>;
  if (error) return <p className="text-center text-red-500">{error}</p>;

  return (
    <div className="supabase-contacts min-h-screen flex flex-col">
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 2rem' }}>
        <HeaderNavigation
          appState={appState === 'SETTINGS' ? 'SETTINGS' : 'VIEWING'}
          isSettingsOpen={isSettingsOpen}
          onNavigate={onNavigate}
        />
        <button
          onClick={handleExportPDF}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
        >
          Save All as PDF
        </button>
      </div>

      <main className="flex-grow p-6">
        {editingContact && appState === 'VIEWING' ? (
          <DataForm
            initialData={editingContact}
            onSave={handleUpdate}
            onDiscard={() => setEditingContact(null)}
            columnConfig={columnConfig}
            isEditing={true}
          />
        ) : contacts.length === 0 ? (
          <p className="text-center text-gray-400">No contacts found.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  {columnConfig.filter(c => c.visible).map(col => (
                    <th key={col.key}>{col.header}</th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(contact => (
                  <tr key={contact.id}>
                    {columnConfig.filter(c => c.visible).map(col => (
                      <td key={col.key} data-label={col.header}>
                        {contact[col.key]}
                      </td>
                    ))}
                    <td className="action-buttons" data-label="Actions">
                      <button onClick={() => setEditingContact(contact)} title="Edit">
                        <EditIcon className="w-5 h-5 text-white" />
                      </button>
                      <button onClick={() => handleDelete(contact.id)} title="Delete">
                        <TrashIcon className="w-5 h-5 text-white" />
                      </button>
                      <button onClick={() => handlePrint(contact)} title="Print">
                        <PrintIcon className="w-5 h-5 text-white" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Hidden container for PDF export */}
      <div id="pdf-export-container" style={{ display: 'none', padding: '20px', background: 'white', color: 'black', width: '800px' }}>
        <div className="company-header">
          <h1>Mateng Delivery</h1>
          <p>Sagolband Sayang Leirak, near Indian Oil Pump</p>
          <p>Mobile: +918787649928</p>
        </div>
        <h2>All Contacts</h2>
        <ul>
          {contacts.map(contact => (
            <li key={contact.id} style={{ marginBottom: '16px' }}>
              {columnConfig.filter(c => c.visible).map(c => (
                <div key={c.key}>
                  <strong>{c.header}:</strong> {contact[c.key] || ''}
                </div>
              ))}
            </li>
          ))}
        </ul>
        <div className="thank-you">
          <p>Thank you for using our services!</p>
          <p>Justmateng Service Pvt. ltd</p>
        </div>
      </div>
    </div>
  );
}
