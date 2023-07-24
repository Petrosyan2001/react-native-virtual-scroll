import React, { RefObject, memo, useCallback, useMemo, useRef, useState } from 'react'
import { Animated, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleProp, View, ViewStyle } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import SafeAreaView from 'react-native-safe-area-view'

import { DataType, VirtualScrollProps, AnyType } from './types'

export const useScrollAware = ({
  onLoadMore,
  onScrollParent,
}: {
  onLoadMore?: () => void
  onScrollParent?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
}): {
  scrollTop: number
  ref: RefObject<ScrollView>
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
  scrollDirection: 'up' | 'down' | null
} => {
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null)

  const [scrollTop, setScrollTop] = useState<number>(0)
  const ref = useRef<ScrollView>(null)
  const prevScrollPositionRef = useRef<number>(0)

  const onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { nativeEvent } = event
      const currentScrollPosition = nativeEvent.contentOffset.y
      const scrollDirection = currentScrollPosition > prevScrollPositionRef.current ? 'down' : 'up'
      setScrollDirection(scrollDirection)
      setScrollTop(nativeEvent.contentOffset.y)
      const contentHeight = event.nativeEvent.contentSize.height
      const scrollViewHeight = event.nativeEvent.layoutMeasurement.height
      const scrollOffset = event.nativeEvent.contentOffset.y
      if (scrollOffset + scrollViewHeight >= contentHeight / 2 - 300) {
        if (scrollDirection === 'down') {
          onLoadMore && onLoadMore()
        }
      }
      prevScrollPositionRef.current = currentScrollPosition
      onScrollParent && onScrollParent(event)
    },
    [onLoadMore, onScrollParent],
  )

  return {
    onScroll,
    ref,
    scrollDirection,
    scrollTop,
  }
}

const AnimHeader: React.FC<AnyType> = ({ animatedValue, height, renderHeader }) => {
  const headerTranslateY = animatedValue.interpolate({
    extrapolate: 'clamp',
    inputRange: [0, height || 0],
    outputRange: [0, -(height || 0)],
  })

  return (
    <Animated.View
      style={{
        backgroundColor: 'transparent',
        bottom: 0,
        height,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
        transform: [{ translateY: headerTranslateY }],
      }}
    >
      {renderHeader()}
    </Animated.View>
  )
}

const AnimatedHeader = memo(AnimHeader)

const VirtualScroll: React.FC<VirtualScrollProps<DataType>> = <T extends DataType>({
  renderAhead: renderCount,
  renderItem,
  childHeight,
  height,
  onLoad,
  header,
  data,
  numColumns,
  onScroll,
  onLoadMore,
  ...props
}: VirtualScrollProps<T>) => {
  const offset = useRef(new Animated.Value(0)).current

  const renderAhead = useMemo(
    () => (renderCount ? renderCount : Math.ceil(height / childHeight)),
    [childHeight, height, renderCount],
  )

  const headerItemCount = useMemo(() => {
    if (header?.headerHeight) {
      return Math.ceil(header?.headerHeight / childHeight)
    }

    return 0
  }, [header, childHeight])

  const itemCount = useMemo(() => data?.length + headerItemCount, [data?.length, headerItemCount])

  const totalHeight = useMemo(() => itemCount * childHeight, [childHeight, itemCount])

  const columns = useMemo(() => Number((numColumns || 0) < 1 ? 1 : numColumns), [numColumns])
  const {
    scrollTop: scroll,
    ref,
    onScroll: handleScroll,
  } = useScrollAware({
    onLoadMore,
    onScrollParent: onScroll,
  })

  const scrollTop = useMemo(() => (scroll < 0 ? 0 : scroll), [scroll])

  const startNode = useMemo(() => Math.floor(scrollTop / childHeight), [childHeight, scrollTop])

  const visibleNodeCount = useMemo(() => {
    let visibleNodeCounts = Math.ceil(height / childHeight) + 2 * renderAhead
    visibleNodeCounts = Math.min(itemCount - startNode, visibleNodeCounts)

    return visibleNodeCounts
  }, [childHeight, height, itemCount, renderAhead, startNode])

  const offsetY = useMemo(() => startNode * childHeight, [childHeight, startNode])

  const visibleNodes = useMemo(() => {
    const nodes: React.ReactNode[] = []
    const startIndex = startNode
    const endIndex = Math.min(startIndex + visibleNodeCount, itemCount)
    for (let i = startIndex; i < endIndex; i++) {
      if (i < headerItemCount) {
        nodes.push(
          <View
            key={i}
            style={{
              height: childHeight,
            }}
          />,
        )
      } else {
        const rows: React.ReactNode[] = []
        for (let j = 0; j < columns; j++) {
          const index = j + i
          const value = data[index - headerItemCount]
          if (value !== undefined) {
            rows.push(
              <View
                key={`${i}-${j}`}
                style={{
                  flex: 1,
                }}
              >
                {renderItem(value as T, i)}
              </View>,
            )
          }
        }

        nodes.push(
          <View
            key={i}
            style={{
              flexDirection: 'row',
              height: childHeight,
            }}
          >
            {rows}
          </View>,
        )
      }
    }

    return nodes
  }, [childHeight, columns, data, headerItemCount, itemCount, renderItem, startNode, visibleNodeCount])

  const handleContentLayout = useCallback(() => {
    onLoad && onLoad()
  }, [onLoad])

  const viewStyle = useMemo(
    () => ({
      transform: [{ translateY: offsetY <= 0 ? 0 : offsetY }],
    }),
    [offsetY],
  )

  const scrollStyle: StyleProp<ViewStyle> = useMemo(() => ({ height, overflow: 'hidden' }), [height])

  const contentStyle: StyleProp<ViewStyle> = useMemo(
    () => ({
      height: totalHeight,
    }),
    [totalHeight],
  )

  const handleOnScroll = useMemo(
    () =>
      header
        ? Animated.event([{ nativeEvent: { contentOffset: { y: offset } } }], {
            listener: handleScroll,
            useNativeDriver: false,
          })
        : handleScroll,
    [header, offset, handleScroll],
  )

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, overflow: 'hidden' }} forceInset={{ top: 'always' }}>
        {header && (
          <AnimatedHeader height={header?.headerHeight} renderHeader={header?.renderHeader} animatedValue={offset} />
        )}
        <ScrollView
          onLayout={handleContentLayout}
          style={scrollStyle}
          ref={ref}
          contentContainerStyle={contentStyle}
          onScroll={handleOnScroll}
          scrollEventThrottle={16}
          {...props}
        >
          <View style={viewStyle}>{visibleNodes}</View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

export default memo(VirtualScroll)
