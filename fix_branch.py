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
              <tr className="bg-gray-50/50import sys

with open('/Users/macbookair/doha-xt
with opebol    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if "{/* Ta     </t
start_idx = -1
end_idx    end_idx = -1
 c
for i, l"text    if "{/* Table Section */}" t-        start_idx = i
    if "{/* Convert Transactions Modgr    if "{/* Convert lo        end_idx = i

replacement = """      {/* Tab"