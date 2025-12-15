"use client"

import { IconMenu } from "@/components/common/icon-menu";
import { Token } from "@/interface/token.interface";
import { CopyCheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

export default function TransactionButton({txn}: {txn: Token}){
    const [trasactioIdCopied, setTrasactioIdCopied] = useState("");


    return <>
    <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    txn.token
                  );
                  toast.success("Token to clipboard!");
                  setTrasactioIdCopied(txn.token);
                  setTimeout(() => setTrasactioIdCopied(""), 2000);
                }}
                className="w-full rounded-md p-2 text-left text-sm font-medium bg-gray-50 text-gray-500 transition-all duration-75 hover:bg-gray-100"
              >

                <IconMenu
                  text={ txn.token}
                  icon={
                    trasactioIdCopied === txn.token ? (
                      <CopyCheckIcon className="h-4 w-4" />
                    ) : (
                      <CopyIcon className="h-4 w-4" />
                    )
                  }
                />
              </button>
    </>

}