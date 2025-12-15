import { Suspense } from "react";
import TokenList from "./_components/tokenslist";
import DesktopSidebar from "../_components/desktop-sidebar";
import RightHeader from "../_components/right-header";
import { get } from "@/lib/fetch";
import { Token } from "@/interface/token.interface";

async function getTokens() {
  try {
    const response = await get<any>("meter/token/");

    if (response.error) {
      console.warn("Failed to fetch tokens:", response.error);
      return [];
    }

    return Array.isArray(response.data?.data)
      ? response.data.data
      : response.data?.data || response.data?.results || [];
  } catch (error) {
    console.error("Error fetching tokens:", error);
    return [];
  }
}

// const TokensPage = async () => {
//   const tokens = await getTokens();

//   return (
//     <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
//       <DesktopSidebar />
//       <div className="flex flex-col">
//         <RightHeader />
//         <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
//           <div className="flex items-center">
//             <h1 className="text-lg font-semibold md:text-2xl">
//               Purchase Units
//             </h1>
//           </div>

//           <div
//             className="flex flex-1 justify-center rounded-lg border border-dashed shadow-sm"
//             x-chunk="dashboard-02-chunk-1"
//           >
//             <div className="flex flex-col gap-1 w-full">
//               <Suspense fallback={<div className="p-4">Loading tokens...</div>}>
//                 <TokenList tokens={tokens} />
//               </Suspense>
//             </div>
//           </div>
//         </main>
//       </div>
//     </div>
//   );
// };

const TokensPage = async () => {
  const tokens = await getTokens();

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <DesktopSidebar />
      <div className="flex flex-col">
        <RightHeader />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold md:text-2xl">
                Token History
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                View all your loan and purchased units tokens
              </p>
            </div>
          </div>

          <div
            className="flex flex-1 justify-center rounded-lg border border-dashed shadow-sm"
            x-chunk="dashboard-02-chunk-1"
          >
            <div className="flex flex-col gap-1 w-full">
              <Suspense fallback={<div className="p-4">Loading tokens...</div>}>
                <TokenList tokens={tokens} />
              </Suspense>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default TokensPage;
