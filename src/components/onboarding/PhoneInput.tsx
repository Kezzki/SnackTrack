import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const COUNTRY_CODES = [
    { code: "+62", country: "ID", flag: "🇮🇩" },
    { code: "+60", country: "MY", flag: "🇲🇾" },
    { code: "+65", country: "SG", flag: "🇸🇬" },
    { code: "+66", country: "TH", flag: "🇹🇭" },
    { code: "+63", country: "PH", flag: "🇵🇭" },
    { code: "+84", country: "VN", flag: "🇻🇳" },
    { code: "+81", country: "JP", flag: "🇯🇵" },
    { code: "+82", country: "KR", flag: "🇰🇷" },
    { code: "+86", country: "CN", flag: "🇨🇳" },
    { code: "+91", country: "IN", flag: "🇮🇳" },
    { code: "+1", country: "US", flag: "🇺🇸" },
    { code: "+44", country: "GB", flag: "🇬🇧" },
    { code: "+61", country: "AU", flag: "🇦🇺" },
];

interface PhoneInputProps {
    value: string;
    onChange: (fullValue: string) => void;
    id?: string;
    placeholder?: string;
    required?: boolean;
    className?: string;
}

export function PhoneInput({ value, onChange, id, placeholder = "812 3456 7890", required, className }: PhoneInputProps) {
    // Parse existing value to extract country code
    const parseValue = (val: string) => {
        for (const cc of COUNTRY_CODES) {
            if (val.startsWith(cc.code)) {
                return { countryCode: cc.code, number: val.slice(cc.code.length).trim() };
            }
        }
        // Default to +62 if no code found
        return { countryCode: "+62", number: val.replace(/^\+?\d{1,3}\s*/, "") };
    };

    const { countryCode: initialCode, number: initialNumber } = parseValue(value);
    const [countryCode, setCountryCode] = useState(initialCode);
    const [localNumber, setLocalNumber] = useState(initialNumber || value);

    const handleCountryChange = (code: string) => {
        setCountryCode(code);
        onChange(`${code} ${localNumber}`.trim());
    };

    const handleNumberChange = (num: string) => {
        setLocalNumber(num);
        onChange(`${countryCode} ${num}`.trim());
    };

    const selected = COUNTRY_CODES.find((c) => c.code === countryCode) || COUNTRY_CODES[0];

    return (
        <div className={cn("flex items-stretch", className)}>
            <Select value={countryCode} onValueChange={handleCountryChange}>
                <SelectTrigger className="w-[100px] rounded-r-none border-r-0 shrink-0">
                    <SelectValue>
                        <span className="flex items-center gap-1.5 text-sm">
                            <span>{selected.flag}</span>
                            <span className="text-muted-foreground">{selected.code}</span>
                        </span>
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {COUNTRY_CODES.map((cc) => (
                        <SelectItem key={cc.code} value={cc.code}>
                            <span className="flex items-center gap-2">
                                <span>{cc.flag}</span>
                                <span className="font-medium">{cc.country}</span>
                                <span className="text-muted-foreground">{cc.code}</span>
                            </span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Input
                id={id}
                type="tel"
                value={localNumber}
                onChange={(e) => handleNumberChange(e.target.value)}
                placeholder={placeholder}
                required={required}
                className="rounded-l-none"
            />
        </div>
    );
}
