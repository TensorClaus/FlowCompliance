import { SectionDMatrix, type SectionDProps } from './SectionD1HighestPaid'

export function SectionD2LowestPaid(props: SectionDProps) {
  return (
    <SectionDMatrix
      {...props}
      counterpartId="eea4-section-d1"
      label="Section D2 - Lowest-paid employees"
      lockSingleEmployeeRows={true}
      sectionId="eea4-section-d2"
      sectionKey="sectionD2"
      testId="eea4-section-d2"
    />
  )
}
