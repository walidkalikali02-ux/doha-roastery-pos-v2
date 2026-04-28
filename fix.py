import sys

with open('/Users/macbookair/doha-roastery-pos-v2/views/BranchPerformanceView.tsx', 'r') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if "{/* Table Section */}" in line and start_idx == -1:
        start_idx = i
    if "{/* Convert Transactions Modal */}" in line:
        end_idx = i

replacement = """      {/* Table Section */}
      <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-black flex items-center gap-2">
            <Award className="text-blue-600" size={20} />
            {t.branchPerformance || 'Branch Performance'}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t.branch || 'Branch'}
                </th>
                <th
                  className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('sales')}
                >
                  <div className="flex items-center gap-1">
                    {t.salesTotal || 'Sales'}
                    <ArrowUpDown size={14} />
                  </div>
                </th>
                <th
                  className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('transactions')}
                >
                  <div className="flex items-center gap-1">
                    {t.transactionsCount || 'Transactions'}
                    <ArrowUpDown size={14} />
                  </div>
                </th>
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t.avgTransaction || 'Avg. Value'}
                </th>
                <th
                  className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('growth')}
                >
                  <div className="flex items-center gap-1">
                    {'Growth'}
                    <ArrowUpDown size={14} />
                  </div>
                </th>
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t.staff || 'Staff'}
                </th>
                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {(t as any).actions || 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="animate-spin text-blue-600" size={32} />
                      <p className="text-sm font-medium text-gray-500">Loading data...</p>
                    </div>
                  </td>
                </tr>
              ) : sortedStats.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-500 font-medium">
                    {'No data available for the selected period.'}
                  </td>
                </tr>
              ) : (
                sortedStats.map((branch, index) => (
                  <tr key={branch.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shadow-sm ${
                            index === 0
                              ? 'bg-gradient-to-br from-yellow-400 to-yellow-600'
                              : index === 1
                                ? 'bg-gradient-to-br from-gray-300 to-gray-500'
                                : index === 2
                                  ? 'bg-gradient-to-br from-amber-600 to-amber-800'
                                  : 'bg-gradient-to-br from-blue-500 to-blue-700'
                          }`}
                        >
                          {branch.name.charAt(0)}
                        </div>
                        <span className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                          {branch.name}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-baseline gap-1">
                        <span className="font-black text-gray-900 font-mono">
                          {branch.totalSales.toFixed(2)}
                        </span>
                        <span className="text-gray-400 text-[10px] font-bold">QAR</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-lg">
                        {branch.totalTransactions}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-baseline gap-1">
                        <span className="font-bold text-gray-700 font-mono">
                          {branch.avgTransactionValue.toFixed(2)}
                        </span>
                        <span className="text-gray-400 text-[10px] font-bold">QAR</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg w-fit ${
                          branch.growth >= 0 
                            ? 'bg-green-50 text-green-700' 
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {branch.growth >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        <span className="font-bold text-xs">{Math.abs(branch.growth).toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-gray-500 font-medium">
                        <Users size={16} className="text-gray-400" />
                        <span>{branch.staffCount}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {branch.id !== 'all' && (
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleExportInvoices(branch.id)}
                            disabled={isExporting}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors disabled:opacity-50"
                          >
                            <FileDown size={14} />
                            {(t as any).export || 'Export'}
                          </button>
                          <button
                            onClick={() => openDeleteModal(branch.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                          >
                            <Trash2 size={14} />
                            {(t as any).delete || 'Delete'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {sortedStats.slice(0, 4).map((branch) => (
          <div
            key={branch.id}
            className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100"
          >
            <h3 className="font-bold text-black mb-4 flex items-center gap-2">
              <Coffee size={20} className="text-blue-600" />
              {t.topProducts || 'Top Products'}: {branch.name}
            </h3>
            <div className="space-y-3">
              {branch.topProducts.length === 0 ? (
                <p className="text-gray-500 text-sm">{t.noProducts || 'No products sold'}</p>
              ) : (
                branch.topProducts.map((product, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                        {idx + 1}
                      </span>
                      <span className="font-medium text-black">{product.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-black">{product.revenue.toFixed(2)} QAR</span>
                      <span className="text-gray-500 text-xs mr-1">({product.quantity})</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <h4 className="font-bold text-black mt-6 mb-3 pt-4 border-t border-gray-100 flex items-center gap-2">
              <Users size={18} className="text-green-600" />
              {t.cashierSales || 'Cashier Sales'}
            </h4>
            <div className="space-y-2">
              {branch.cashierSales && branch.cashierSales.length > 0 ? (
                branch.cashierSales.map((cs, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center p-2 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <span className="font-medium text-black">{cs.cashier_name}</span>
                      <span className="text-xs text-gray-500 mr-2">
                        ({cs.sales_count} {t.sales || 'sales'})
                      </span>
                    </div>
                    <span className="font-bold text-green-600">
                      {cs.total_amount.toFixed(2)} QAR
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">{t.noCashierData || 'No cashier data'}</p>
              )}
            </div>
          </div>
        ))}
      </div>
"""

with open('/Users/macbookair/doha-roastery-pos-v2/views/BranchPerformanceView.tsx', 'w') as f:
    f.writelines(lines[:start_idx])
    f.write(replacement)
    f.writelines(lines[end_idx:])

print("Done")
