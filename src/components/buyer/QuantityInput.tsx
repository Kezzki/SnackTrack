import { useState } from "react";

interface QuantityInputProps {
    value: number;
    max: number;
    onChange: (v: number) => void;
}

export function QuantityInput({ value, max, onChange }: QuantityInputProps) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(String(value));

    const commit = () => {
        setEditing(false);
        const parsed = parseInt(draft, 10);
        if (!isNaN(parsed) && parsed >= 1) {
            onChange(Math.min(parsed, max));
        } else if (!isNaN(parsed) && parsed <= 0) {
            onChange(0); // remove item
        } else {
            setDraft(String(value)); // revert
        }
    };

    if (editing) {
        return (
            <input
                type="number"
                max={max}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === "Enter") commit();
                    if (e.key === "Escape") { setDraft(String(value)); setEditing(false); }
                }}
                autoFocus
                className="w-12 h-7 text-center text-sm font-medium rounded-md border border-primary bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
        );
    }

    return (
        <button
            onClick={() => { setDraft(String(value)); setEditing(true); }}
            className="w-8 h-7 text-sm font-medium text-center rounded-md hover:bg-muted transition-colors cursor-text"
            title="Klik untuk edit jumlah"
        >
            {value}
        </button>
    );
}
