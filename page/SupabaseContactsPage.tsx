import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase/supabaseClient';
import { ColumnConfig, ExtractedData } from '../types';
import { DataForm } from '../components/DataForm';
import { PrintIcon, EditIcon, TrashIcon } from '../components/Icons';
import { HeaderNavigation } from '../components/HeaderNavigation';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import './jj.css';
import JsBarcode from 'jsbarcode';


const DEFAULT_COLUMNS: ColumnConfig[] = [
  // { key: 'six_digit_id', header: 'ID', visible: true },
  { key: 'address', header: 'Address', visible: true },
  { key: 'name', header: 'Name', visible: true },
  { key: 'phone', header: 'Phone', visible: true },
  { key: 'product_Amt', header: 'Product Amount', visible: true },
  { key: 'delivery_Amt', header: 'Delivery Amount', visible: true },
  { key: 'mode', header: 'Mode', visible: true },
  { key: 'date_added', header: 'Date Added', visible: true },
  { key: 'total_amount', header: 'Total Amount', visible: true },
  { key: 'company', header: 'Company', visible: true },
];


export default function SupabaseContactsPage() {
  const [contacts, setContacts] = useState<ExtractedData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<ExtractedData | null>(null);
  const [columnConfig] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [appState, setAppState] = useState<'VIEWING' | 'EDITING' | 'SETTINGS'>('VIEWING');

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

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

  const filteredContacts = contacts.filter(contact => {
    if (!startDate && !endDate) return true;
    const contactDate = new Date(contact.date_added);
    const from = startDate ? new Date(startDate) : null;
    const to = endDate ? new Date(endDate) : null;
    return (!from || contactDate >= from) && (!to || contactDate <= to);
  });

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
            body { font-family: Arial, sans-serif; padding: 20px; background: white; color: black; }
            .print-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
            .company-name { font-size: 35px; font-weight: bold; }
            .id-block { text-align: right; font-family: 'OCR A Std', monospace; }
            .id-number { font-size: 28px; letter-spacing: 6px; user-select: none; }
            .barcode-upc { margin-top: 8px; display: flex; justify-content: flex-end; gap: 2px; }
            .barcode-bar { width: 3px; background: black; }
            .bar-0 { height: 50px; }
            .bar-1 { height: 90px; }
            .bar-2 { height: 50px; }
            .bar-3 { height: 90px; }
            .bar-4 { height: 50px; }
            .bar-5 { height: 90px; }
            .bar-6 { height: 50px; }
            .bar-7 { height: 90px; }
            .bar-8 { height: 50px; }
            .bar-9 { height: 150px; }

            h2 { font-size: 20px; margin-bottom: 10px; }
            ul { list-style: none; padding: 0; }
            li { margin-bottom: 8px; font-size: 16px; }
            .thank-you { margin-top: 40px; text-align: center; font-size: 14px; color: gray; }
          </style>
        </head>
        <body>
          <div class="print-header">
            <div class="company-name">
              Mateng Delivery<br />
              Sagolband Sayang Leirak, near Indian Oil Pump<br />
              Mobile: +918787649928
            </div>
            <div class="id-block">
              <div class="id-number">${sixDigitId}</div>
              <div class="barcode-upc">
                ${sixDigitId.split('').map(digit => `<div class="barcode-bar bar-${digit}"></div>`).join('')}
              </div>
            </div>
          </div>

          <h2>Contact Details</h2>
          <ul>
  ${columnConfig.filter(c => c.visible).map(c => {
    let value = contact[c.key] || '';
    if (c.key === 'total_amount') {
      const deliveryAmt = parseFloat(contact.delivery_Amt) || 0;
      const productAmt = parseFloat(contact.product_Amt) || 0;
      value = (deliveryAmt + productAmt).toFixed(2);
    }

    const largeFields = ['company', 'address'];
    const isLarge = largeFields.includes(c.key);
    
    return `
      <li>
        <strong style="font-size: 50px;">${c.header}:</strong>
        <span style="${isLarge ? 'font-size: 30px; font-weight: bold;' : ''}">
          ${value}
        </span>
      </li>`;
  }).join('')}
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
const handleDeleteFiltered = async () => {
  if (filteredContacts.length === 0) {
    alert('No filtered contacts to delete.');
    return;
  }

  const confirmed = window.confirm(
    `Are you sure you want to delete all ${filteredContacts.length} filtered contacts? This action cannot be undone.`
  );
  if (!confirmed) return;

  try {
    const idsToDelete = filteredContacts.map(contact => contact.id);

    const { error } = await supabase
      .from('contacts')
      .delete()
      .in('id', idsToDelete);

    if (error) {
      console.error('Error deleting filtered contacts:', error);
      alert('Failed to delete contacts. Check the console for more details.');
    } else {
      setContacts(prev => prev.filter(c => !idsToDelete.includes(c.id)));
    }
  } catch (err) {
    console.error('Unexpected error during deletion:', err);
    alert('Unexpected error occurred.');
  }
};

  const handleExportPDF = async () => {
  try {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '1000px';
    container.style.padding = '20px';
    container.style.background = 'white';
    container.style.color = 'black';
    container.style.zIndex = '-1';
    document.body.appendChild(container);

    for (let i = 0; i < filteredContacts.length; i++) {
      const contact = filteredContacts[i];
      container.innerHTML = '';

      // Header
      const header = document.createElement('div');
      header.style.marginBottom = '20px';
      header.innerHTML = `
        <h1 style="margin:0; font-size:24px;">Mateng Delivery</h1>
        <p style="margin:0;">Sagolband Sayang Leirak, near Indian Oil Pump</p>
        <p style="margin:0;">Mobile: +918787649928</p>
        <hr style="margin-top: 10px; margin-bottom: 20px;" />
      `;
      container.appendChild(header);

      // Contact info container
      const content = document.createElement('div');
      content.style.fontSize = '18px';
      content.style.lineHeight = '1.5';

      // Add contact fields
      columnConfig
        .filter(c => c.visible)
        .forEach(c => {
          const row = document.createElement('div');
          let value = contact[c.key] || '';
if (c.key === 'total_amount') {
  const deliveryAmt = parseFloat(contact.delivery_Amt) || 0;
  const productAmt = parseFloat(contact.product_Amt) || 0;
  value = (deliveryAmt + productAmt).toFixed(2);
}

          let fontSize = '18px';
let fontWeight = 'normal';

if (['company', 'address'].includes(c.key)) {
  fontSize = '40px';
  fontWeight = 'bold';
}
if (c.key === 'total_amount') {
  fontSize = '26px';
  fontWeight = 'bold';
}

row.innerHTML = `<strong style="font-size: 20px;">${c.header}:</strong> <span style="font-size: ${fontSize}; font-weight: ${fontWeight};">${value}</span>`;


          content.appendChild(row);
        });

      container.appendChild(content);

      // --- Add barcode like in print ---

      // Create barcode container
      const sixDigitId = contact.six_digit_id?.toString().padStart(6, '0') ?? '';
      const barcodeDiv = document.createElement('div');
      barcodeDiv.style.display = 'flex';
      barcodeDiv.style.justifyContent = 'flex-end';
      barcodeDiv.style.gap = '2px';
      barcodeDiv.style.marginTop = '15px';

      // Helper to create one bar div with height based on digit
      const createBar = (digit: string) => {
        const bar = document.createElement('div');
        bar.style.width = '3px';
        bar.style.backgroundColor = 'black';
        bar.style.userSelect = 'none';

        // Heights alternate between 50 and 90 px based on digit parity to mimic your style
        // You can adjust this logic to match your exact style
        const tallDigits = ['1', '3', '5', '7', '9'];
        bar.style.height = tallDigits.includes(digit) ? '90px' : '50px';
        return bar;
      };

      // Create bars for each digit
      sixDigitId.split('').forEach(digit => {
        barcodeDiv.appendChild(createBar(digit));
      });

      container.appendChild(barcodeDiv);

      // Footer
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

      await new Promise(r => setTimeout(r, 100));

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
      <div className="p-6">
        <HeaderNavigation
          appState={appState === 'SETTINGS' ? 'SETTINGS' : 'VIEWING'}
          isSettingsOpen={isSettingsOpen}
          onNavigate={onNavigate}
        />

        <div className="flex flex-wrap items-center justify-between mt-4 gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Start Date:</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            />
            <label className="text-sm text-gray-700">End Date:</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            />
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="ml-2 text-sm text-blue-600 hover:underline"
            >
              Clear
            </button>
          </div>

          <button
            onClick={handleExportPDF}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-4 rounded"
          >
            Save All as PDF
          </button>
        </div><br />
        <div>
          <button
  onClick={handleDeleteFiltered}
  className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-4 rounded"
>
  Delete All Filtered Contacts
</button>

        </div>
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
        ) : filteredContacts.length === 0 ? (
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
  {filteredContacts.map(contact => (
    <tr key={contact.id}>
      {columnConfig.filter(c => c.visible).map(col => {
        if (col.key === 'total_amount') {
          const deliveryAmt = parseFloat(contact.delivery_Amt) || 0;
          const productAmt = parseFloat(contact.product_Amt) || 0;
          const total = deliveryAmt + productAmt;
          return (
            <td key={col.key} data-label={col.header}>
              {total.toFixed(2)} {/* format with 2 decimals */}
            </td>
          );
        } else {
          // Style "address" and "company" to be larger
          const isLargeField = ['address', 'company', 'name'].includes(col.key);

          return (
            <td
              key={col.key}
              data-label={col.header}
              style={isLargeField ? { fontSize: '1.2rem', fontWeight: 'bold' } : undefined}
            >
              {contact[col.key]}
            </td>
          );
        }
      })}
      <td className="action-buttons" data-label="Actions">
        {/* action buttons */}
      </td>
    </tr>
  ))}
</tbody>


            </table>
          </div>
        )}
      </main>
    </div>
  );
}
