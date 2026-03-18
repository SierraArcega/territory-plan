"use client";

export default function FilesTab() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-12 h-12 rounded-full bg-[#F7F5FA] flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-[#A69DC0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-[#403770]">Files</p>
      <p className="text-xs text-[#A69DC0] mt-1">Coming soon</p>
      <p className="text-xs text-[#C2BBD4] mt-0.5 max-w-[200px]">
        Attach documents, images, and other files to this activity
      </p>
    </div>
  );
}
