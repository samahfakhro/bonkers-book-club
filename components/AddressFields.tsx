'use client'

// The written-address fields shown after a pin is confirmed. Shared by signup (step 3) and
// Settings → Delivery Info, so the two always ask for exactly the same thing with the same rules.

export type AddressValue = {
  houseType: string     // 'villa' | 'apartment' | ''
  villaFlat: string
  building: string
  street: string
  subCommunity: string
  area: string
}

export type AddressField = keyof AddressValue

// Required: Villa/Flat choice, villa/flat number, street, community/area — plus building name for flats
export function validateAddress(v: AddressValue): Partial<Record<AddressField, string>> {
  const errs: Partial<Record<AddressField, string>> = {}
  if (!v.houseType) errs.houseType = 'Please select Villa or Flat'
  if (v.houseType === 'apartment' && !v.building.trim()) errs.building = 'Required'
  if (!v.villaFlat.trim()) errs.villaFlat = 'Required'
  if (!v.street.trim()) errs.street = 'Required'
  if (!v.area.trim()) errs.area = 'Required'
  return errs
}

type Props = {
  value: AddressValue
  onChange: (field: AddressField, value: string) => void
  errors: Partial<Record<string, string>>
  inputClass: string
  labelStyle: React.CSSProperties
}

const errorStyle: React.CSSProperties = { position: 'absolute', color: '#e05c3a', fontSize: '0.75rem', lineHeight: 1.2, marginTop: '2px', fontFamily: 'var(--font-montserrat), sans-serif' }
const optional: React.CSSProperties = { textTransform: 'none', fontWeight: 400, opacity: 0.55 }

export default function AddressFields({ value, onChange, errors, inputClass, labelStyle }: Props) {
  return (
    <>
      {/* Villa / Flat toggle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {[{ value: 'villa', label: 'Villa' }, { value: 'apartment', label: 'Flat' }].map(opt => (
          <button key={opt.value} type="button"
            onClick={() => onChange('houseType', opt.value)}
            style={{ flex: 1, padding: '10px 0', borderRadius: '10px', border: `2px solid ${value.houseType === opt.value ? '#1a2744' : '#ddd6cc'}`, backgroundColor: value.houseType === opt.value ? '#1a2744' : '#fefaf2', color: value.houseType === opt.value ? '#fefaf2' : '#1a2744', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
            {opt.label}
          </button>
        ))}
      </div>
      {errors.houseType && <p style={{ color: '#e05c3a', fontSize: '0.78rem', marginTop: '-12px', marginBottom: '12px', fontFamily: 'var(--font-montserrat), sans-serif' }}>{errors.houseType}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'end' }}>
          <div>
            <label style={labelStyle}>Villa / Flat Number</label>
            <input type="text" value={value.villaFlat} onChange={e => onChange('villaFlat', e.target.value)} className={inputClass} />
            {errors.villaFlat && <p style={errorStyle}>{errors.villaFlat}</p>}
          </div>
          <div>
            <label style={labelStyle}>Building Name <span style={{ ...optional, opacity: 0.6 }}>(flats only)</span></label>
            <input type="text" value={value.building} onChange={e => onChange('building', e.target.value)} className={inputClass} disabled={value.houseType !== 'apartment'} style={{ opacity: value.houseType !== 'apartment' ? 0.4 : 1 }} />
            {errors.building && <p style={errorStyle}>{errors.building}</p>}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'end' }}>
          <div>
            <label style={labelStyle}>Street</label>
            <input type="text" value={value.street} onChange={e => onChange('street', e.target.value)} placeholder="e.g. Street 12" className={inputClass} />
            {errors.street && <p style={errorStyle}>{errors.street}</p>}
          </div>
          <div>
            <label style={labelStyle}>Sub-community <span style={optional}>(optional)</span></label>
            <input type="text" value={value.subCommunity} onChange={e => onChange('subCommunity', e.target.value)} placeholder="e.g. Saheel" className={inputClass} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'end' }}>
          <div>
            <label style={labelStyle}>Community / Area</label>
            <input type="text" value={value.area} onChange={e => onChange('area', e.target.value)} placeholder="e.g. Arabian Ranches" className={inputClass} />
            {errors.area && <p style={errorStyle}>{errors.area}</p>}
          </div>
          <div>
            <label style={labelStyle}>Emirate</label>
            <input type="text" value="Dubai" readOnly disabled className={inputClass} style={{ cursor: 'not-allowed', opacity: 0.6 }} />
          </div>
        </div>
      </div>
    </>
  )
}
