import { ScrollViewProps } from 'react-native/types'
export type AnyType = any

export type DataType = AnyType

export type VirtualScrollHeader = {
  headerHeight: number
  renderHeader: () => React.ReactNode
}

type VirtualScrollProps<T> = {
  data: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  renderAhead?: number
  childHeight: number
  height: number
  onLoad?: () => void
  header?: VirtualScrollHeader
  numColumns?: number
  onLoadMore?: () => void
} & ScrollViewProps
